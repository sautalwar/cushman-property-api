export interface Tenant {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  propertyId: string;
  leaseStartDate: Date;
  leaseEndDate: Date;
  monthlyRent: number;
  securityDeposit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTenantDto {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  propertyId: string;
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRent: number;
  securityDeposit: number;
}
