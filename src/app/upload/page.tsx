'use client';

import { FileUpload } from '@/components/upload/FileUpload';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function UploadPage() {
  return (
    <AuthGuard>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <FileUpload />
      </div>
    </AuthGuard>
  );
}
