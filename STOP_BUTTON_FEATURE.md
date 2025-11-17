# Quick Reply Stop Button Feature

## Overview
Users can now add an interactive "Stop Receiving Messages" button to WhatsApp campaigns. When recipients tap this button, they are automatically added to a blocklist and will not receive future campaign messages.

## Features

### 1. Interactive Quick Reply Button
- Uses the new WhatsApp Interactive Message format with `quick_reply` buttons
- Recipients see a "🚫 Stop Receiving Messages" button they can tap
- No typing required - instant one-tap unsubscribe

### 2. Automatic Blocklist Management
- When a user taps the stop button, their number is automatically added to the blocklist
- Blocked numbers are stored in the `blocked_numbers` database table
- The system sends a confirmation message: "✅ You have been unsubscribed. You will not receive any more messages from us."

### 3. Campaign Filtering
- Before sending each campaign message, the system checks if the number is blocked
- Blocked numbers are skipped with a log message: `⏭️ Skipping blocked number`
- Failed list shows reason: "Number is blocked (user opted out)"

### 4. Fallback Support
- If interactive messages fail (WhatsApp API issues), the system falls back to text messages
- Text fallback includes: "🚫 Reply "STOP" to stop receiving messages"
- URLs in button text are auto-clickable in WhatsApp

## How to Use

### Creating a Campaign with Stop Button

1. **Open Campaigns Page** (via dashboard or directly at `/campaigns`)

2. **Fill Campaign Details**:
   - Campaign Name
   - Original Message Template (use `{{name}}` for personalization)
   - Fixed Parameters (optional)

3. **Add Interactive Buttons** (optional):
   - Click "Show Buttons"
   - Add buttons like "Visit Website", "Book Appointment", etc.
   - Each button can have text and a URL

4. **Enable Stop Button**:
   - ✅ Check the box: **"Include 'Stop Messages' Quick Reply Button"**
   - This adds the unsubscribe option to your message

5. **Upload Contacts** (Excel/CSV with columns: `name`, `phone`)

6. **Send Campaign**

### What Recipients See

When a campaign has the stop button enabled:

```
[Your personalized message]

🔗 Visit Website: https://example.com
🚫 Stop Receiving Messages [Quick Reply Button]

Reply STOP to unsubscribe
```

### Blocklist API Endpoints

#### Add to Blocklist
```bash
POST /api/blocklist/add
Body: {
  "phoneNumber": "919876543210",
  "reason": "user_requested"  # optional, default: "user_requested"
}
```

#### Remove from Blocklist
```bash
POST /api/blocklist/remove
Body: {
  "phoneNumber": "919876543210"
}
```

#### Check if Blocked
```bash
GET /api/blocklist/check/919876543210
Response: {
  "isBlocked": true
}
```

#### Get All Blocked Numbers
```bash
GET /api/blocklist
Response: [
  {
    "id": "uuid",
    "phoneNumber": "919876543210",
    "reason": "user_requested",
    "blockedAt": "2025-01-01T12:00:00Z"
  }
]
```

## Technical Details

### Database Schema

**blocked_numbers table**:
- `id`: UUID primary key
- `phoneNumber`: Text, unique (cleaned format: digits only)
- `reason`: Text (default: "user_requested")
  - Options: "user_requested", "spam", "admin_blocked"
- `blockedAt`: Timestamp

**campaigns table** (updated):
- Added `includeStopButton`: Text ("true" or "false")

### WhatsApp Service

**sendMessageWithButtons()** method signature:
```typescript
async sendMessageWithButtons(
  phoneNumber: string,
  message: string,
  buttons: Array<{ text: string; url?: string; phoneNumber?: string }>,
  includeStopButton = false
): Promise<any>
```

**Interactive Message Format**:
```typescript
{
  interactiveMessage: {
    body: { text: message },
    footer: { text: 'Reply STOP to unsubscribe' },
    nativeFlowMessage: {
      buttons: [
        {
          name: 'cta_url',  // or 'cta_call'
          buttonParamsJson: JSON.stringify({
            display_text: 'Visit Website',
            url: 'https://example.com'
          })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: '🚫 Stop Receiving Messages',
            id: 'STOP_MESSAGES'
          })
        }
      ]
    }
  }
}
```

### Event Handling

**Button Click Detection**:
```typescript
socket.ev.on('messages.upsert', async ({ messages }) => {
  const msg = messages[0];
  if (msg.message?.interactiveResponseMessage) {
    const res = msg.message.interactiveResponseMessage.nativeFlowResponseMessage;
    const buttonId = JSON.parse(res.paramsJson)?.id;
    
    if (buttonId === 'STOP_MESSAGES') {
      // Add to blocklist
      // Send confirmation
    }
  }
});
```

## Best Practices

1. **Always Enable for Bulk Campaigns**: Include the stop button on all promotional/bulk messages to comply with anti-spam guidelines

2. **Clear Communication**: Let users know they can unsubscribe easily - builds trust

3. **Monitor Opt-Out Rates**: High opt-out rates may indicate message relevance issues

4. **Respect Blocklist**: Never manually override the blocklist - always honor user preferences

5. **Regular Cleanup**: Periodically review blocked numbers and ensure they're not accidentally added back

## Deployment Notes

- Database migrations applied automatically via `drizzle-kit push`
- No environment variables required
- Works with existing Baileys WhatsApp integration
- Compatible with both DigitalOcean App Platform and local development

## Commit

Changes deployed in commit: `2c0779a`
- 7 files changed
- 340 insertions, 8 deletions
- Includes schema updates, service layer changes, API routes, and UI components
