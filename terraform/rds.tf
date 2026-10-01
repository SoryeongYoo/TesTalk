# =============================================================================
# rds.tf — PostgreSQL RDS (프라이빗 서브넷 전용)
# -----------------------------------------------------------------------------
# 만들어지는 구조:
#
#   testalk-tf-db-subnet-group : 프라이빗 서브넷 2개(2a, 2c)
#   testalk-tf-db-sg           : 5432 인바운드만 허용
#                                  - 출처: VPC CIDR(10.0.0.0/16)
#                                  - 출처: db_allowed_security_group_ids(지정 시)
#                                  - 0.0.0.0/0 규칙 없음, 아웃바운드 규칙 없음
#   testalk-tf-db              : PostgreSQL, db.t4g.micro, 단일 AZ, 20GB,
#                                publicly_accessible = false
#
# 콘솔로 만든 기존 RDS(testalk-database)와는 identifier가 다른 완전히 별개의
# 인스턴스다. 이 코드는 기존 리소스를 참조/import 하지 않는다.
#
# 비용 주의: RDS는 켜져 있는 동안 시간당 과금된다. db.t4g.micro + 20GB는
# 프리티어 범위지만, 계정의 프리티어 기간/크레딧이 끝났다면 요금이 나온다.
# apply 전에 Billing 콘솔 → Free Tier 에서 RDS 사용 가능 여부를 확인할 것.
# =============================================================================

# -----------------------------------------------------------------------------
# DB 서브넷 그룹 — RDS가 배치될 수 있는 서브넷 목록. 최소 2개 AZ 필요.
# vpc.tf와 같은 루트 모듈이므로 output이 아니라 리소스를 직접 참조한다.
# (outputs.tf의 private_subnet_ids와 같은 값이다.)
# -----------------------------------------------------------------------------
resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-db-subnet-group"
  description = "Private subnets for ${var.project_name} RDS"
  subnet_ids  = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

# -----------------------------------------------------------------------------
# 보안그룹
# Terraform으로 만든 보안그룹은 AWS 콘솔과 달리 "모두 허용" 아웃바운드 규칙이
# 자동으로 붙지 않는다. RDS는 먼저 바깥으로 연결을 열 필요가 없으므로
# 아웃바운드 규칙은 일부러 두지 않았다. (들어온 연결의 응답은 보안그룹이
# stateful이라 그대로 나간다.)
#
# 규칙은 aws_security_group 안의 ingress 블록 대신 별도 리소스
# (aws_vpc_security_group_ingress_rule)로 정의했다. 규칙 하나가 리소스 하나라
# plan에서 어떤 규칙이 추가/삭제되는지 보기 쉽다.
# -----------------------------------------------------------------------------
resource "aws_security_group" "db" {
  name        = "${var.project_name}-db-sg"
  description = "PostgreSQL access from inside the VPC only"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-db-sg"
  }
}

# VPC 내부 어디서든 5432 허용 (VPC CIDR 밖에서는 라우팅상 도달 자체가 불가능)
resource "aws_vpc_security_group_ingress_rule" "db_from_vpc" {
  security_group_id = aws_security_group.db.id
  description       = "PostgreSQL from VPC CIDR"
  ip_protocol       = "tcp"
  from_port         = 5432
  to_port           = 5432
  cidr_ipv4         = aws_vpc.main.cidr_block

  tags = {
    Name = "${var.project_name}-db-from-vpc"
  }
}

# 지정한 보안그룹에서 오는 5432 허용 (기본값은 빈 목록 → 규칙 0개)
# 나중에 앱 서버/Lambda 보안그룹이 생기면 그 ID를 변수에 넣으면 된다.
resource "aws_vpc_security_group_ingress_rule" "db_from_sg" {
  for_each = toset(var.db_allowed_security_group_ids)

  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from ${each.value}"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = each.value

  tags = {
    Name = "${var.project_name}-db-from-${each.value}"
  }
}

# -----------------------------------------------------------------------------
# RDS 인스턴스
# -----------------------------------------------------------------------------
resource "aws_db_instance" "main" {
  identifier = "${var.project_name}-db"

  # --- 엔진 ---
  engine = "postgres"
  # 메이저 버전만 지정 → 그 메이저의 최신 마이너 버전으로 생성된다.
  engine_version             = var.db_engine_version
  auto_minor_version_upgrade = true

  # --- 사양 (프리티어 범위) ---
  instance_class    = "db.t4g.micro"
  allocated_storage = 20
  storage_type      = "gp3"
  # max_allocated_storage를 지정하지 않음 → 스토리지 자동 확장 꺼짐.
  # 20GB를 넘어 과금되는 일을 막는다.
  multi_az = false

  # 저장 데이터 암호화. AWS 관리형 키(aws/rds)를 쓰므로 추가 비용 없음.
  storage_encrypted = true

  # --- 네트워크 ---
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  # 퍼블릭 IP를 받지 않는다. 프라이빗 서브넷 + 이 설정 + 보안그룹의 3중 차단.
  publicly_accessible = false
  port                = 5432

  # --- 초기 DB / 계정 ---
  db_name  = var.db_name
  username = var.db_username
  # password_wo = write-only 인자 (Terraform 1.11+). 값이 AWS로 전달만 되고
  # terraform.tfstate와 plan 출력에는 저장되지 않는다.
  # 비밀번호를 바꾸려면 tfvars의 값을 바꾸고 password_wo_version을 1 올려야 한다.
  # (write-only 값은 state에 없어서 Terraform이 변경을 스스로 감지하지 못한다.)
  password_wo         = var.db_password
  password_wo_version = 1

  # --- 백업 / 유지보수 ---
  # 프리티어 계정은 보존 기간이 길면 생성이 거부될 수 있어 1일로 둔다.
  backup_retention_period = 1
  copy_tags_to_snapshot   = true

  # --- 삭제 동작 (IaC 실습용 설정) ---
  # 실습용이라 terraform destroy로 바로 지울 수 있게 했다.
  # 실제 데이터를 넣기 시작하면 deletion_protection = true,
  # skip_final_snapshot = false(+ final_snapshot_identifier)로 바꿀 것.
  deletion_protection = false
  skip_final_snapshot = true

  tags = {
    Name = "${var.project_name}-db"
  }
}
