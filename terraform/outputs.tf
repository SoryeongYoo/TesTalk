# =============================================================================
# outputs.tf — apply 후 출력할 값
# -----------------------------------------------------------------------------
# - apply가 끝나면 터미널에 출력되고, 이후에도 `terraform output`으로 조회할 수 있다.
# - 다음 단계(RDS)에서 DB 서브넷 그룹을 만들 때 private_subnet_ids를 사용한다.
# - 아직 apply 전이므로 plan 단계에서는 "(known after apply)"로 표시된다.
# =============================================================================

output "vpc_id" {
  description = "생성된 VPC ID"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "VPC CIDR 블록"
  value       = aws_vpc.main.cidr_block
}

output "public_subnet_ids" {
  description = "퍼블릭 서브넷 ID 목록 (availability_zones 순서)"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "프라이빗 서브넷 ID 목록 (availability_zones 순서) — 향후 RDS 서브넷 그룹용"
  value       = aws_subnet.private[*].id
}

output "internet_gateway_id" {
  description = "인터넷 게이트웨이 ID"
  value       = aws_internet_gateway.main.id
}

output "public_route_table_id" {
  description = "퍼블릭 라우트 테이블 ID"
  value       = aws_route_table.public.id
}

output "private_route_table_id" {
  description = "프라이빗 라우트 테이블 ID"
  value       = aws_route_table.private.id
}

# -----------------------------------------------------------------------------
# RDS
# 엔드포인트는 VPC 내부에서만 연결 가능하다(퍼블릭 액세스 꺼짐).
# 비밀번호는 출력하지 않는다.
# -----------------------------------------------------------------------------

output "db_endpoint" {
  description = "RDS 엔드포인트 (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "db_address" {
  description = "RDS 호스트명"
  value       = aws_db_instance.main.address
}

output "db_port" {
  description = "RDS 포트"
  value       = aws_db_instance.main.port
}

output "db_name" {
  description = "초기 데이터베이스 이름"
  value       = aws_db_instance.main.db_name
}

output "db_security_group_id" {
  description = "RDS 보안그룹 ID — 앱 쪽 보안그룹에서 아웃바운드 대상으로 사용"
  value       = aws_security_group.db.id
}

output "db_subnet_group_name" {
  description = "DB 서브넷 그룹 이름"
  value       = aws_db_subnet_group.main.name
}
