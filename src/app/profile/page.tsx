'use client';

import { ProfileView } from '@/components/profile/ProfileView';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function ProfilePage() {
  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ProfileView />
      </div>
    </AuthGuard>
  );
}
