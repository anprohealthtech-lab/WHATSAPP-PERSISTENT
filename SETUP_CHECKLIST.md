# Campaign System Setup Guide

## ✅ What You Have
1. ✅ Supabase URL and Service Role Key
2. ✅ Google AI Key
3. ✅ Database URL
4. ✅ Edge Function (you mentioned it's created)
5. ✅ Existing tables: users, messages, system_logs

## 📋 What You Need to Do Now

### Step 1: Create Campaign Tables in Supabase

Go to your Supabase Dashboard → SQL Editor and run this SQL:

```sql
-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  original_message TEXT NOT NULL,
  fixed_params JSONB,
  selected_variation TEXT,
  total_contacts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create campaign_recipients table
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  extra JSONB,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMP,
  error_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create message_variations table
CREATE TABLE IF NOT EXISTS message_variations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  variation TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_id_idx ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_recipients_status_idx ON campaign_recipients(status);
CREATE INDEX IF NOT EXISTS message_variations_campaign_id_idx ON message_variations(campaign_id);
```

### Step 2: Verify Edge Function

Your edge function should be at: `https://zvbmbawglcdmncknzmfh.supabase.co/functions/v1/bulk-message-generator`

**Test it with curl:**
```bash
curl -X POST https://zvbmbawglcdmncknzmfh.supabase.co/functions/v1/bulk-message-generator \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "message": "Hi {{name}}, reminder for {{date}}",
    "campaign_id": "test-123",
    "fixed_params": {
      "name_placeholder": "{{name}}",
      "date": "20 Nov 2025"
    }
  }'
```

### Step 3: Add Environment Variables to Frontend

Create or update `NodeBackend/client/.env`:

```env
VITE_SUPABASE_URL=https://zvbmbawglcdmncknzmfh.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

### Step 4: Install pg dependency

```bash
cd NodeBackend
npm install pg
```

### Step 5: Test the System

1. Start the backend:
```bash
npm run dev
```

2. Open browser to: `http://localhost:5173/campaigns` (or wherever your frontend runs)

3. Test the flow:
   - Create a campaign
   - Upload contacts Excel file
   - Generate variation
   - Send to contacts

## 📊 What Your Database Should Have Now

After running the SQL, you should have these tables:

**Existing:**
- ✅ users
- ✅ messages  
- ✅ system_logs

**New (Campaign System):**
- 🆕 campaigns
- 🆕 campaign_recipients
- 🆕 message_variations

## 🔧 Troubleshooting

### Can't connect to database?
- Check DATABASE_URL doesn't have extra quotes
- Verify password in connection string
- Try connection pooler port (6543) vs direct port (5432)

### Edge function not working?
- Deploy the edge function code I provided in `supabase-edge-function-example.ts`
- Add GEMINI_API_KEY to Supabase Edge Function secrets
- Test with curl first before using frontend

### Tables not creating?
- Run the SQL directly in Supabase Dashboard
- Check for existing table conflicts
- Verify you're in the correct project

## 📁 Files You Need

All files are already created in your repo:

1. ✅ `NodeBackend/server/services/CampaignService.ts` - Backend service
2. ✅ `NodeBackend/server/routes.ts` - API endpoints
3. ✅ `NodeBackend/client/src/components/CampaignMessageVariationPanel.tsx` - React component
4. ✅ `NodeBackend/client/src/pages/campaigns.tsx` - Campaign page
5. ✅ `shared/schema.ts` - Database schema
6. ✅ `NodeBackend/migrations/0001_add_campaign_tables.sql` - SQL migration
7. ✅ `CAMPAIGN_BULK_MESSAGING.md` - Full documentation
8. ✅ `supabase-edge-function-example.ts` - Edge function template

## 🚀 Next Steps

1. **Run the SQL** in Supabase Dashboard (Step 1 above)
2. **Install pg**: `npm install pg`
3. **Start server**: `npm run dev`
4. **Test**: Create a campaign with 1-2 test contacts

That's it! Everything else is already set up in the code.
