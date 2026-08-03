import { NextResponse } from 'next/server';

// Shared function to get a valid Salesforce OAuth token
async function getSalesforceToken(): Promise<string> {
    const oauthUrl = "https://cloudcertitude-a.my.salesforce.com/services/oauth2/token";
    const clientId = process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Missing Salesforce credentials");
    }

    const oauthBody = new URLSearchParams();
    oauthBody.append('grant_type', 'client_credentials');
    oauthBody.append('client_id', clientId);
    oauthBody.append('client_secret', clientSecret);

    const oauthResponse = await fetch(oauthUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: oauthBody.toString()
    });

    if (!oauthResponse.ok) {
        throw new Error("Failed to authenticate with Salesforce");
    }

    const oauthData = await oauthResponse.json();
    return oauthData.access_token;
}

export async function POST(request: Request) {
    try {
        // 1. Get the activity payload from the frontend
        const payload = await request.json();

        // 2. Get OAuth token
        const accessToken = await getSalesforceToken();

        // 3. Call Salesforce Website Activity Apex REST API
        const sfEndpoint = "https://cloudcertitude-a.my.salesforce.com/services/apexrest/website/activity";
        const response = await fetch(sfEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        // 4. Return response (fire-and-forget: always return 200 to not block the UI)
        const contentType = response.headers.get("content-type");
        let data = null;
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        }

        return NextResponse.json({ success: true, data });

    } catch (error) {
        // Log server-side but don't block the user's journey
        console.error("Website Activity Tracking Error:", error);
        return NextResponse.json({ success: false }, { status: 200 });
    }
}
