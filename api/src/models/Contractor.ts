export type ContractorSpecialty = 'plumbing' | 'electrical' | 'roofing';

export interface Contractor {
  id: string;
  userId: string;
  companyName: string;
  specialty: ContractorSpecialty;
  hourlyRate: number;
  isVerified: boolean;
  rating: number;
  webhookUrl: string | null;
  createdAt: Date;
}

export interface CreateContractorDto {
  companyName: string;
  specialty: ContractorSpecialty;
  hourlyRate: number;
}

export interface UpdateContractorDto {
  companyName?: string;
  hourlyRate?: number;
  webhookUrl?: string;
  // VULN-3: isVerified and role should NOT be here but are accepted from req.body
  isVerified?: boolean;
  role?: string;
}