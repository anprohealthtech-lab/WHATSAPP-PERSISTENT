// Supabase Edge Function: bulk-message-generator
// Deploy this to: supabase/functions/bulk-message-generator/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { message, campaign_id, fixed_params } = await req.json()

    // Build the AI prompt
    const prompt = `
You are a professional WhatsApp message writer for healthcare appointment reminders.

YOUR TASK:
Rewrite the following message to be more natural and conversational while maintaining WhatsApp character limits (160 characters preferred, 300 max).

CRITICAL RULES:
1. Do NOT change or remove the placeholder {{name}}. It MUST appear exactly as {{name}} in your output.
2. Replace all other placeholders with the values provided in fixed_params below.
3. Keep the message professional but friendly
4. Use simple, clear language
5. Avoid emojis unless they add value
6. Keep it concise and actionable

ORIGINAL MESSAGE:
${message}

FIXED PARAMETERS (replace these placeholders in your output):
${JSON.stringify(fixed_params, null, 2)}

IMPORTANT: The {{name}} placeholder must remain unchanged. Only replace other placeholders.

Provide ONLY the rewritten message, nothing else.
`

    // Call Gemini API
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
          topP: 0.8,
          topK: 40
        }
      })
    })

    const data = await response.json()

    if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
      throw new Error('Invalid response from Gemini API')
    }

    let variation = data.candidates[0].content.parts[0].text.trim()
    
    // Remove any markdown formatting
    variation = variation.replace(/```.*?\n/g, '').replace(/```/g, '').trim()

    // Verify {{name}} is still present
    if (!variation.includes('{{name}}')) {
      console.warn('Warning: AI removed {{name}} placeholder, adding it back')
      variation = variation.replace(/Hi |Hey |Hello /i, (match) => `${match}{{name}}, `)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        variation,
        campaign_id,
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (error) {
    console.error('Error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to generate variation'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
