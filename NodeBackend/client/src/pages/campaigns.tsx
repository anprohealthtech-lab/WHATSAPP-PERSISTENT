import { CampaignMessageVariationPanel } from '@/components/CampaignMessageVariationPanel';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';

export default function CampaignsPage() {
  const [, setLocation] = useLocation();
  
  // These should come from environment variables or configuration
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/bulk-message-generator`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <Button variant="outline" onClick={() => setLocation('/')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">WhatsApp Campaign Manager</h1>
          <p className="text-gray-600 mt-2">Create and manage bulk messaging campaigns with AI-generated variations</p>
        </div>
        <CampaignMessageVariationPanel
          supabaseUrl={supabaseUrl}
          supabaseAnonKey={supabaseAnonKey}
          edgeFunctionUrl={edgeFunctionUrl}
        />
      </div>
    </div>
  );
}
