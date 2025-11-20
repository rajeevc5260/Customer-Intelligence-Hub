export interface Client {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  createdAt: string;
  approvedInsightsCount: number;
}

export interface Stakeholder {
  id: string;
  clientId: string;
  name: string;
  role: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export interface Insight {
  id: string;
  clientId: string | null;
  projectId: string | null;
  stakeholderId: string | null;
  authorId: string | null;
  rawText: string;
  summary: string | null;
  themes: string | null;
  timeHorizon?: string | null;
  budgetSignal?: string | null;
  competitorMention?: string | null;
  status: string;
  createdAt: string;
  author?: {
    id: string;
    fullName: string | null;
    email: string | null;
  } | null;
}

export interface Opportunity {
  id: string;
  clientId: string;
  insightId: string | null;
  title: string;
  description: string | null;
  valueEstimate: string | null;
  stage: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  topic: string;
  description: string | null;
  questions: string | null;
  status: string;
  responseCount: number;
  createdAt: string;
}

export interface CampaignResponse {
  id: string;
  userId: string;
  clientId: string;
  rawResponse: string;
  summary: string | null;
  extractedThemes: string | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

