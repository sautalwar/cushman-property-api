export type JobStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'disputed';

export interface Job {
  id: string;
  title: string;
  description: string;
  propertyId: string;
  ownerId: string;
  assignedContractorId: string | null;
  status: JobStatus;
  requiredSpecialty: 'plumbing' | 'electrical' | 'roofing';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobDto {
  title: string;
  description: string;
  propertyId: string;
  requiredSpecialty: 'plumbing' | 'electrical' | 'roofing';
}