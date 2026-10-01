# =============================================================================
# vpc.tf — 네트워크(VPC) 구성
# -----------------------------------------------------------------------------
# 만들어지는 구조:
#
#   VPC 10.0.0.0/16 (testalk-tf-vpc)
#   ├─ 퍼블릭 서브넷  10.0.1.0/24 (2a), 10.0.2.0/24 (2c)
#   │    └─ 퍼블릭 라우트 테이블: 0.0.0.0/0 → 인터넷 게이트웨이
#   └─ 프라이빗 서브넷 10.0.11.0/24 (2a), 10.0.12.0/24 (2c)
#        └─ 프라이빗 라우트 테이블: VPC 내부(local) 경로만 존재 → 인터넷과 단절
#
# NAT Gateway는 의도적으로 만들지 않았다. RDS는 외부로 나가는 인터넷 연결이
# 필요 없고, NAT Gateway는 켜두기만 해도 시간당 과금되기 때문이다.
# 프라이빗 서브넷에서 아웃바운드가 필요해지면 그때 추가한다.
# =============================================================================

# -----------------------------------------------------------------------------
# VPC
# -----------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  # RDS 엔드포인트 같은 DNS 이름을 VPC 안에서 해석하려면 둘 다 true여야 한다.
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# -----------------------------------------------------------------------------
# 서브넷
# count = AZ 개수만큼 반복 생성하고, count.index로 같은 순서의 AZ/CIDR를 짝짓는다.
# -----------------------------------------------------------------------------
resource "aws_subnet" "public" {
  count = length(var.availability_zones)

  vpc_id            = aws_vpc.main.id
  availability_zone = var.availability_zones[count.index]
  cidr_block        = var.public_subnet_cidrs[count.index]

  # 이 서브넷에 뜨는 인스턴스에 퍼블릭 IP를 자동 부여하지 않는다(보수적 기본값).
  # "퍼블릭" 여부는 이 옵션이 아니라 IGW로 가는 라우팅(아래)으로 결정된다.
  # 퍼블릭 IP가 필요한 리소스는 리소스 쪽에서 명시적으로 켠다.
  map_public_ip_on_launch = false

  tags = {
    Name = "${var.project_name}-public-${var.availability_zones[count.index]}"
    Tier = "public"
  }
}

resource "aws_subnet" "private" {
  count = length(var.availability_zones)

  vpc_id            = aws_vpc.main.id
  availability_zone = var.availability_zones[count.index]
  cidr_block        = var.private_subnet_cidrs[count.index]

  map_public_ip_on_launch = false

  tags = {
    Name = "${var.project_name}-private-${var.availability_zones[count.index]}"
    Tier = "private"
  }
}

# -----------------------------------------------------------------------------
# 인터넷 게이트웨이 — VPC와 인터넷을 잇는 관문. VPC당 1개.
# -----------------------------------------------------------------------------
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# -----------------------------------------------------------------------------
# 퍼블릭 라우팅 — 모든 외부 트래픽(0.0.0.0/0)을 IGW로 보낸다.
# (VPC 내부 트래픽용 local 경로는 AWS가 자동으로 추가한다.)
# -----------------------------------------------------------------------------
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# -----------------------------------------------------------------------------
# 프라이빗 라우팅 — route 블록이 없으므로 VPC 내부(local) 경로만 존재한다.
# 명시적으로 만들어 연결해두는 이유: 연결하지 않으면 서브넷이 VPC의 "main"
# 라우트 테이블을 암묵적으로 따라가는데, 누군가 main 테이블에 IGW 경로를
# 추가하면 프라이빗 서브넷이 의도치 않게 인터넷에 노출될 수 있기 때문이다.
# -----------------------------------------------------------------------------
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
