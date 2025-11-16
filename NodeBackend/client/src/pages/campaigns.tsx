import { CampaignMessageVariationPanel } from '@/components/CampaignMessageVariationPanel';

export default function CampaignsPage() {
  // These should come from environment variables or configuration
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/bulk-message-generator`;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">WhatsApp Campaign Manager</h1>
      <CampaignMessageVariationPanel
        supabaseUrl={supabaseUrl}
        supabaseAnonKey={supabaseAnonKey}
        edgeFunctionUrl={edgeFunctionUrl}
      />
    </div>
  );
}
