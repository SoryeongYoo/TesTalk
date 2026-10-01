# =============================================================================
# variables.tf — 입력 변수 정의
# -----------------------------------------------------------------------------
# - 여기서는 변수의 "선언"과 기본값만 둔다. 값을 바꾸고 싶으면 코드를 고치지 말고
#   terraform.tfvars 파일이나 -var 옵션으로 덮어쓴다.
#   (*.tfvars는 향후 비밀값이 들어갈 수 있어 .gitignore로 제외되어 있다.)
# - 기본값만으로 plan/apply가 가능하도록 모든 변수에 default를 지정했다.
# =============================================================================

variable "aws_region" {
  description = "리소스를 생성할 AWS 리전 (서울)"
  type        = string
  default     = "ap-northeast-2"
}

variable "project_name" {
  description = "Name 태그 접두사. 콘솔로 만든 기존 리소스와 구분하기 위해 testalk-tf 사용"
  type        = string
  default     = "testalk-tf"
}

variable "vpc_cidr" {
  description = "VPC 전체 IP 대역"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "서브넷을 분산 배치할 AZ 목록. RDS 서브넷 그룹은 최소 2개 AZ가 필요하다."
  type        = list(string)
  default     = ["ap-northeast-2a", "ap-northeast-2c"]
}

variable "public_subnet_cidrs" {
  description = "퍼블릭 서브넷 CIDR 목록. availability_zones와 같은 순서/개수로 매핑된다."
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "프라이빗 서브넷 CIDR 목록(향후 RDS 배치). availability_zones와 같은 순서/개수로 매핑된다."
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

# -----------------------------------------------------------------------------
# RDS
# -----------------------------------------------------------------------------

variable "db_engine_version" {
  description = "PostgreSQL 메이저 버전. 해당 메이저의 최신 마이너 버전으로 생성된다."
  type        = string
  default     = "17"
}

variable "db_name" {
  description = "RDS 생성 시 함께 만들 초기 데이터베이스 이름"
  type        = string
  default     = "testalk"
}

variable "db_username" {
  description = "마스터 사용자 이름 (postgres, rdsadmin 등 예약어 불가)"
  type        = string
  default     = "testalk_admin"
}

variable "db_password" {
  description = "마스터 비밀번호. 기본값 없음 — terraform.tfvars에서 지정한다(커밋 금지)."
  type        = string
  # sensitive: plan/apply 출력에서 값이 (sensitive value)로 가려진다.
  sensitive = true

  # RDS PostgreSQL 비밀번호 규칙: 8~128자, 출력 가능한 ASCII, / @ " 공백 불가
  validation {
    condition     = length(var.db_password) >= 8 && length(var.db_password) <= 128 && !can(regex("[/@\" ]", var.db_password))
    error_message = "db_password는 8~128자여야 하고 / @ \" 공백을 포함할 수 없습니다."
  }
}

variable "db_allowed_security_group_ids" {
  description = "5432 접근을 추가로 허용할 보안그룹 ID 목록 (VPC CIDR 허용과 별개). 기본값 없음."
  type        = list(string)
  default     = []
}
