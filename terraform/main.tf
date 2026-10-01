# =============================================================================
# main.tf — Terraform 자체와 AWS provider 설정
# -----------------------------------------------------------------------------
# - 이 폴더(terraform/)의 모든 .tf 파일은 하나의 "루트 모듈"로 합쳐져 처리된다.
#   파일 분리는 사람이 읽기 위한 것이고, Terraform 입장에서는 순서/파일명이 무관하다.
# - 콘솔로 만든 기존 리소스와는 완전히 별개의 세트를 만든다. 이 코드는 기존
#   리소스를 import 하거나 참조하지 않으므로 기존 리소스에는 영향이 없다.
# =============================================================================

terraform {
  # 이 코드를 실행할 수 있는 Terraform CLI 버전 범위
  # 1.11+: rds.tf의 password_wo(write-only 인자)를 쓰기 위해 필요
  required_version = ">= 1.11.0"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # 6.x 안에서만 업데이트(메이저 업그레이드로 인한 breaking change 방지).
      # 실제 설치된 정확한 버전은 init 시 생성되는 .terraform.lock.hcl에 고정된다.
      version = "~> 6.0"
    }
  }

  # state 저장 위치(backend). 지금은 지정하지 않아 로컬 파일(terraform.tfstate)에
  # 저장된다. state에는 리소스 ID·설정값(향후 RDS 비밀번호 등)이 평문으로 들어가므로
  # 절대 커밋하지 않는다(.gitignore 참고). 나중에 S3 backend로 옮기는 것을 권장.
  # backend "s3" { ... }
}

provider "aws" {
  region = var.aws_region

  # 이 provider로 만드는 "모든" 리소스에 자동으로 붙는 태그.
  # Name 태그는 리소스마다 달라야 하므로 각 리소스에서 개별 지정한다.
  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
    }
  }
}
