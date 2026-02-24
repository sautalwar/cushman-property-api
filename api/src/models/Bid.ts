export interface Bid {
  id: string;
  jobId: string;
  contractorId: string;
  amount: number;
  note: string | null;
  submittedAt: Date;
}

export interface CreateBidDto {
  amount: number;
  note?: string;
}