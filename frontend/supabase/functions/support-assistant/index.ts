/**
 * Support Assistant Edge Function
 * Handles AI-powered support chat responses
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Initialize Supabase client
function getSupabaseClient(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: { Authorization: authHeader || "" },
    },
  });
}

// Context-aware knowledge base for GST-related questions
const knowledgeBase: Record<string, { answer: string; citations: Array<{ title: string; source: string }> }> = {
  "gstr1": {
    answer: `GSTR-1 is a monthly return that details all outward supplies of goods and services. Here's what you need to know:

**Who should file GSTR-1?**
- All registered taxpayers with GSTIN (except composition taxpayers)
- Monthly filing for regular taxpayers
- Quarterly filing for quarterly taxpayers

**What to include in GSTR-1:**
1. Outward supplies (B2B, B2C, EXP)
2. Tax collected at source (TCS)
3. Zero-rated, exempted, and nil-rated supplies
4. HSN-wise summary of outward supplies

**Key Points:**
- Due date is 10th of the next month
- Must be filed before GSTR-3B
- Invoice-level details required for B2B supplies
- Summary-level allowed for B2C (above ₹2.5 lakhs)

**Filing Process:**
1. Login to GST portal
2. Navigate to Returns > Returns Dashboard
3. Select Financial Year and Tax Period
4. File GSTR-1
5. Add HSN details and submit with DSC/EVC`,
    citations: [
      { title: "GSTR-1 Guide", source: "GST Portal" },
      { title: "GST Return Filing Rules", source: "CGST Act 2017" }
    ]
  },
  "gstr3b": {
    answer: `GSTR-3B is a monthly self-assessment return that summarizes:
- Outward supplies (from GSTR-1)
- Inward supplies (from GSTR-2A/2B)
- Input Tax Credit (ITC)
- Tax liability and payment

**Key Features:**
- Due date: 20th of next month (monthly taxpayers)
- Must be filed even if no transactions
- Tax payment mandatory before filing

**Sections in GSTR-3B:**
1. Details of outward supplies
2. Details of inward supplies
3. ITC availed
4. ITC reversed
5. Tax payable and paid
6. Interest calculation (if any)`,
    citations: [
      { title: "GSTR-3B Filing", source: "GST Portal" }
    ]
  },
  "ims": {
    answer: `IMS (Invoice Management System) is a new initiative by GSTN to help taxpayers reconcile their invoices before filing GSTR-1 and GSTR-3B.

**Purpose of IMS:**
- Match your purchase invoices with supplier's sales
- Identify missing or mismatched invoices
- Resolve discrepancies before filing returns

**Key Features:**
1. Document-wise matching
2. Accept/Reject/Mismatch status
3.IMS enables matching input tax credit claims with corresponding output tax liabilities
4. It will be mandatory to file GSTR-1/3B only after filing IMS

**Two Views in IMS:**
1. **Inward Supplies (Receiver View):** Match invoices received from suppliers
2. **Outward Supplies (Supplier View):** See how your customers have accepted your invoices`,
    citations: [
      { title: "Invoice Management System", source: "GSTN" }
    ]
  },
  "dsc": {
    answer: `DSC (Digital Signature Certificate) is required for:
- Filing GST returns
- Applying for GST registration
- Amendment/cancellation of registration
- Refund applications

**Types of DSC:**
1. Class 2 (being deprecated)
2. Class 3 (required for GST filings)
3. e-Sign (alternative to DSC)

**Setup Process:**
1. Purchase DSC from licensed Certifying Authority
2. Install DSC token driver
3. Configure DSC in GST portal
4. Register DSC against your GSTIN

**Supported Certifying Authorities:**
- eMudhra
- SafeScrpt
- Capricorn
- nCode Solutions`,
    citations: [
      { title: "DSC Registration", source: "GST Portal" }
    ]
  },
  "workspace security": {
    answer: `Workspace security settings control access to your organization:

**Login Providers:**
- Google SSO
- Microsoft SSO  
- Username/Password

**Security Features:**
- Session timeout (auto-logout after inactivity)
- Two-factor authentication
- IP whitelisting (enterprise)

**Best Practices:**
1. Enable SSO for easier access
2. Set session timeout to 15-30 minutes
3. Review user access regularly
4. Remove inactive users`,
    citations: [
      { title: "Security Settings", source: "App Documentation" }
    ]
  },
  "subscription": {
    answer: `Subscription plans available:

**Professional Plan:**
- All GST forms (GSTR-1, 3B, 2A/2B, etc.)
- Unlimited users
- IMS access
- Priority support

**Enterprise Plan:**
- Everything in Professional
- Custom integrations
- Dedicated account manager
- API access
- White-label options

**Billing:**
- Annual billing (discounted)
- Monthly billing available
- GST extra on all plans`,
    citations: [
      { title: "Pricing", source: "Website" }
    ]
  }
};

// Find relevant knowledge based on user query
function findRelevantKnowledge(query: string): { answer: string; citations: Array<{ title: string; source: string }> } | null {
  const lowerQuery = query.toLowerCase();
  
  for (const [key, value] of Object.entries(knowledgeBase)) {
    if (lowerQuery.includes(key.toLowerCase())) {
      return value;
    }
  }
  
  return null;
}

// Generate AI response based on context and query
function generateResponse(query: string, context: {
  workspaceId?: string;
  userId?: string;
  module?: string;
  route?: string;
}): { text: string; citations: Array<{ title: string; url?: string; source: string }>; suggestedActions: Array<{ label: string; action_type: string; payload?: Record<string, unknown> }> } {
  
  // First check knowledge base
  const knowledge = findRelevantKnowledge(query);
  
  if (knowledge) {
    return {
      text: knowledge.answer,
      citations: knowledge.citations.map(c => ({ ...c, url: undefined })),
      suggestedActions: generateSuggestedActions(knowledge.citations[0]?.title || "")
    };
  }
  
  // Check if asking about specific module
  if (context.module) {
    const moduleKnowledge = findRelevantKnowledge(context.module);
    if (moduleKnowledge) {
      return {
        text: `Based on your current context (${context.module}):\n\n${moduleKnowledge.answer}`,
        citations: moduleKnowledge.citations.map(c => ({ ...c, url: undefined })),
        suggestedActions: generateSuggestedActions(context.module)
      };
    }
  }
  
  // Default response with general help
  return {
    text: `Thank you for your question about "${query}". 

I'm here to help with:
- GSTR-1, GSTR-3B, GSTR-2B filing
- Invoice Management System (IMS)
- GST registration and compliance
- DSC configuration
- Workspace and user management
- Subscription and billing

Could you please provide more details about what you'd like to know? You can also navigate to the relevant section in the app for specific help.`,
    citations: [],
    suggestedActions: [
      { label: "Go to GSTR-1", action_type: "navigate", payload: { route: "/gstr1" } },
      { label: "Go to Settings", action_type: "navigate", payload: { route: "/settings" } }
    ]
  };
}

// Generate suggested actions based on topic
function generateSuggestedActions(topic: string): Array<{ label: string; action_type: string; payload?: Record<string, unknown> }> {
  const actions: Array<{ label: string; action_type: string; payload?: Record<string, unknown> }> = [];
  
  switch (topic.toLowerCase()) {
    case "gstr-1":
    case "gstr1":
      actions.push(
        { label: "File GSTR-1", action_type: "navigate", payload: { route: "/gstr1" } },
        { label: "View GSTR-1 Guide", action_type: "open_doc", payload: { doc: "gstr1" } }
      );
      break;
    case "gstr-3b":
    case "gstr3b":
      actions.push(
        { label: "File GSTR-3B", action_type: "navigate", payload: { route: "/gstr3b" } },
        { label: "View GSTR-3B Guide", action_type: "open_doc", payload: { doc: "gstr3b" } }
      );
      break;
    case "ims":
      actions.push(
        { label: "Open IMS", action_type: "navigate", payload: { route: "/ims" } },
        { label: "Learn about IMS", action_type: "open_doc", payload: { doc: "ims" } }
      );
      break;
    case "dsc":
      actions.push(
        { label: "Configure DSC", action_type: "navigate", payload: { route: "/settings/dsc-configuration" } }
      );
      break;
    case "workspace security":
      actions.push(
        { label: "Security Settings", action_type: "navigate", payload: { route: "/settings/workspace/security" } }
      );
      break;
    case "subscription":
      actions.push(
        { label: "View Plans", action_type: "navigate", payload: { route: "/settings/subscriptions" } }
      );
      break;
    default:
      actions.push(
        { label: "Go to Dashboard", action_type: "navigate", payload: { route: "/dashboard" } }
      );
  }
  
  return actions;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient(req);
    
    // Get request body
    const { message, conversationId, workspaceId, userId, module, route, context } = await req.json();
    
    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user info for context
    let userContext = {};
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", userId)
        .single();
      
      if (profile) {
        userContext = { userName: profile.full_name };
      }
    }

    // Get workspace info
    let workspaceContext = {};
    if (workspaceId) {
      const { data: workspace } = await supabase
        .from("organizations")
        .select("name, billing_gstin")
        .eq("id", workspaceId)
        .single();
      
      if (workspace) {
        workspaceContext = { workspaceName: workspace.name, gstin: workspace.billing_gstin };
      }
    }

    // Build full context
    const fullContext = {
      workspaceId,
      userId,
      module,
      route,
      ...userContext,
      ...workspaceContext,
      ...context
    };

    // Generate AI response
    const response = generateResponse(message, fullContext);
    
    // Truncate long responses
    const maxLength = 2000;
    const truncated = response.text.length > maxLength;
    const finalText = truncated ? response.text.slice(0, maxLength) + "..." : response.text;

    return new Response(
      JSON.stringify({
        conversationId,
        text: finalText,
        truncated,
        citations: response.citations,
        suggestedActions: response.suggestedActions
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in support-assistant:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
