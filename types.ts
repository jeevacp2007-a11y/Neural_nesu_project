export type Language = 'en' | 'kn' | 'hi' | 'ta';
export type DocumentType = 'identity' | 'address_proof';
export type ApplicationStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Correction Required' | 'Resubmitted' | 'Review Completed (Demo)' | 'Review Rejected (Demo)';

export interface PortalUser { id: string; email?: string }
export interface PortalSession { user: PortalUser }

export interface CustomerDetails {
  full_name: string;
  date_of_birth: string;
  phone: string;
  address: string;
  preferred_language: Language;
  /** Local-demo marker. Demo records are only created in Local Demo Mode. */
  demo_only?: true;
  /** Stable sample/scenario identifier used to keep reset scoped to demo records. */
  demo_sample_id?: string;
}

export interface ExtractedFields {
  name: string;
  dateOfBirth: string;
  documentNumber: string;
  address: string;
  issueDate: string;
}

export interface DocumentRecord {
  id: string;
  application_id: string;
  document_type: DocumentType;
  storage_path: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  ocr_text: string;
  extracted_fields: ExtractedFields;
  corrected_fields: ExtractedFields;
  ocr_status: 'complete' | 'failed' | 'needs-review';
  is_current: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ReviewHistoryRecord {
  id: string;
  application_id: string;
  actor_id: string;
  actor_role: 'customer' | 'employee';
  action: string;
  note: string | null;
  created_at: string;
}

export interface ApplicationRecord {
  id: string;
  reference_number: string;
  customer_id: string;
  service_type: string;
  form_data: CustomerDetails;
  status: ApplicationStatus;
  correction_message: string | null;
  created_at: string;
  submitted_at: string | null;
  updated_at: string;
  resubmitted_at: string | null;
  documents?: DocumentRecord[];
  review_history?: ReviewHistoryRecord[];
}

export interface DraftDocument {
  file: File | null;
  previewUrl: string | null;
  ocrText: string;
  extractedFields: ExtractedFields;
  correctedFields: ExtractedFields;
  ocrStatus: 'complete' | 'failed' | 'needs-review';
  ocrConfidence: number;
  ocrWarning: string;
  technicalError: string;
  progress: number;
  processing: boolean;
  error: string;
  existing?: DocumentRecord;
}

export const emptyDetails = (language: Language = 'en'): CustomerDetails => ({
  full_name: '', date_of_birth: '', phone: '', address: '', preferred_language: language,
});

export const emptyFields = (): ExtractedFields => ({
  name: '', dateOfBirth: '', documentNumber: '', address: '', issueDate: '',
});
