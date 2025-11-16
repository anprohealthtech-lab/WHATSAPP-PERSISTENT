import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, Send, RefreshCw } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  originalMessage: string;
  fixedParams: Record<string, any>;
  selectedVariation?: string;
  totalContacts: number;
}

interface Contact {
  name: string;
  phone: string;
  extra?: Record<string, any>;
}

interface MessageVariation {
  id: string;
  variation: string;
  createdAt: string;
}

interface CampaignMessageVariationPanelProps {
  campaignId?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  edgeFunctionUrl: string;
}

export function CampaignMessageVariationPanel({
  campaignId: initialCampaignId,
  supabaseUrl,
  supabaseAnonKey,
  edgeFunctionUrl,
}: CampaignMessageVariationPanelProps) {
  const [campaignId, setCampaignId] = useState(initialCampaignId || '');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [variations, setVariations] = useState<MessageVariation[]>([]);
  const [selectedVariation, setSelectedVariation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  // New campaign form state
  const [newCampaignName, setNewCampaignName] = useState('');
  const [originalMessage, setOriginalMessage] = useState('');
  const [fixedParams, setFixedParams] = useState<Record<string, string>>({});

  // Extract placeholders from message
  const extractPlaceholders = (message: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const placeholders = new Set<string>();
    let match;
    
    while ((match = regex.exec(message)) !== null) {
      if (match[1] !== 'name') { // Exclude {{name}} as it's per-contact
        placeholders.add(match[1]);
      }
    }
    
    return Array.from(placeholders);
  };

  // Update fixed params when a field changes
  const updateFixedParam = (key: string, value: string) => {
    setFixedParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Get placeholders from current message
  const placeholders = extractPlaceholders(originalMessage);

  useEffect(() => {
    if (campaignId) {
      loadCampaign();
      loadContacts();
      loadVariations();
    }
  }, [campaignId]);

  const loadCampaign = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`);
      const data = await response.json();
      
      if (data.success) {
        setCampaign(data.data);
        setSelectedVariation(data.data.selectedVariation || '');
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError('Failed to load campaign: ' + err.message);
    }
  };

  const loadContacts = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/contacts`);
      const data = await response.json();
      
      if (data.success) {
        setContacts(data.data);
      }
    } catch (err: any) {
      setError('Failed to load contacts: ' + err.message);
    }
  };

  const loadVariations = async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/variations`);
      const data = await response.json();
      
      if (data.success) {
        setVariations(data.data);
      }
    } catch (err: any) {
      setError('Failed to load variations: ' + err.message);
    }
  };

  const createCampaign = async () => {
    try {
      setError('');

      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCampaignName,
          originalMessage,
          fixedParams: fixedParams,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setCampaignId(data.data.id);
        setCampaign(data.data);
        setSuccess('Campaign created successfully!');
        setNewCampaignName('');
        setOriginalMessage('');
        setFixedParams({});
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError('Failed to create campaign: ' + err.message);
    }
  };

  const generateVariation = async () => {
    if (!campaign) return;
    
    try {
      setIsGenerating(true);
      setError('');

      // Call Supabase Edge Function
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          message: campaign.originalMessage,
          campaign_id: campaignId,
          fixed_params: {
            name_placeholder: '{{name}}',
            ...campaign.fixedParams,
          },
        }),
      });

      const data = await response.json();
      
      if (data.success && data.tweaked_message) {
        // Save variation to database
        const saveResponse = await fetch(`/api/campaigns/${campaignId}/variations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variation: data.tweaked_message }),
        });

        if (saveResponse.ok) {
          setSelectedVariation(data.tweaked_message);
          await loadVariations();
          setSuccess('New variation generated successfully!');
        }
      } else {
        setError('Failed to generate variation');
      }
    } catch (err: any) {
      setError('Failed to generate variation: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadFile || !campaignId) return;

    try {
      setIsUploading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch(`/api/campaigns/${campaignId}/contacts/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Contacts loaded: ${data.total}`);
        await loadContacts();
        await loadCampaign();
        setUploadFile(null);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError('Failed to upload contacts: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const sendBulkMessages = async () => {
    if (!selectedVariation) {
      setError('Generate or select a variation first');
      return;
    }

    if (contacts.length === 0) {
      setError('Upload contact list first');
      return;
    }

    if (!confirm(`Send campaign to ${contacts.length} contacts? This will take ${Math.ceil(contacts.length * 1.25)} minutes.`)) {
      return;
    }

    try {
      setIsSending(true);
      setError('');

      const response = await fetch(`/api/campaigns/${campaignId}/send-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variation_message: selectedVariation,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Campaign sent! Total: ${data.total}, Sent: ${data.sent}, Failed: ${data.failed}`);
        if (data.failed > 0) {
          console.log('Failed contacts:', data.failed_list);
        }
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError('Failed to send campaign: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  if (!campaignId) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Create New Campaign</CardTitle>
          <CardDescription>Set up a new WhatsApp campaign with message variations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="campaignName">Campaign Name</Label>
            <Input
              id="campaignName"
              value={newCampaignName}
              onChange={(e) => setNewCampaignName(e.target.value)}
              placeholder="e.g., Appointment Reminders"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="originalMessage">Original Message Template</Label>
            <Textarea
              id="originalMessage"
              value={originalMessage}
              onChange={(e) => setOriginalMessage(e.target.value)}
              placeholder="Hi {{name}}, reminder for your appointment on {{date}} at {{time}}."
              rows={4}
            />
            <p className="text-sm text-muted-foreground">
              Use {'{{name}}'} for recipient name. Other placeholders like {'{{date}}'}, {'{{time}}'} will show as fields below.
            </p>
          </div>

          {placeholders.length > 0 && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
              <Label className="text-base font-semibold">Fixed Parameters</Label>
              <p className="text-sm text-muted-foreground">
                Fill in values for placeholders found in your message:
              </p>
              {placeholders.map((placeholder) => (
                <div key={placeholder} className="space-y-2">
                  <Label htmlFor={placeholder} className="flex items-center gap-2">
                    <code className="text-xs bg-secondary px-2 py-1 rounded">
                      {'{{' + placeholder + '}}'}
                    </code>
                    {placeholder.charAt(0).toUpperCase() + placeholder.slice(1)}
                  </Label>
                  <Input
                    id={placeholder}
                    value={fixedParams[placeholder] || ''}
                    onChange={(e) => updateFixedParam(placeholder, e.target.value)}
                    placeholder={`Enter value for ${placeholder}`}
                  />
                </div>
              ))}
            </div>
          )}

          <Button onClick={createCampaign} className="w-full">
            Create Campaign
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      {/* Campaign Info */}
      {campaign && (
        <Card>
          <CardHeader>
            <CardTitle>{campaign.name}</CardTitle>
            <CardDescription>Campaign ID: {campaignId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <Label>Original Message</Label>
                <p className="text-sm mt-1 p-2 bg-muted rounded">{campaign.originalMessage}</p>
              </div>
              <Badge variant="secondary">Contacts: {campaign.totalContacts}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Recipients Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Recipients</CardTitle>
          <CardDescription>Upload contacts from Excel file (.xlsx, .xls, .csv)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contactFile">Contact File</Label>
            <Input
              id="contactFile"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
            <p className="text-sm text-muted-foreground">
              Expected columns: <strong>name</strong>, <strong>phone</strong>
            </p>
          </div>

          <Button 
            onClick={handleFileUpload} 
            disabled={!uploadFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" /> Upload Contacts</>
            )}
          </Button>

          {contacts.length > 0 && (
            <div className="mt-4">
              <p className="font-semibold mb-2">Contacts loaded: {contacts.length}</p>
              <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1">
                {contacts.slice(0, 10).map((contact, idx) => (
                  <div key={idx} className="text-sm">
                    {contact.name} – {contact.phone}
                  </div>
                ))}
                {contacts.length > 10 && (
                  <p className="text-sm text-muted-foreground">
                    ...and {contacts.length - 10} more
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Variations Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Message Variations</CardTitle>
          <CardDescription>Generate and manage message variations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={generateVariation} 
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" /> Generate New Variation</>
            )}
          </Button>

          {selectedVariation && (
            <div className="space-y-2">
              <Label>Current Variation</Label>
              <Textarea
                value={selectedVariation}
                onChange={(e) => setSelectedVariation(e.target.value)}
                rows={4}
                className="font-mono text-sm"
              />
            </div>
          )}

          {variations.length > 0 && (
            <div className="space-y-2">
              <Label>History ({variations.length} variations)</Label>
              <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-2">
                {variations.map((v) => (
                  <div 
                    key={v.id}
                    className="text-sm p-2 bg-muted rounded cursor-pointer hover:bg-muted/80"
                    onClick={() => setSelectedVariation(v.variation)}
                  >
                    <p className="text-xs text-muted-foreground mb-1">
                      {new Date(v.createdAt).toLocaleString()}
                    </p>
                    <p>{v.variation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Campaign Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Send Campaign</CardTitle>
          <CardDescription>Bulk send messages to all contacts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={selectedVariation ? 'default' : 'secondary'}>
                Active variation: {selectedVariation ? 'Set' : 'Not set'}
              </Badge>
              <Badge variant={contacts.length > 0 ? 'default' : 'secondary'}>
                Contacts loaded: {contacts.length}
              </Badge>
            </div>
          </div>

          <Button 
            onClick={sendBulkMessages} 
            disabled={isSending || !selectedVariation || contacts.length === 0}
            className="w-full"
            variant="default"
          >
            {isSending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending Campaign...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Send to All Contacts</>
            )}
          </Button>

          <p className="text-sm text-muted-foreground">
            {contacts.length > 0 && (
              <>Estimated time: {Math.ceil(contacts.length * 1.25)} minutes (1-1.5 min per contact)</>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
