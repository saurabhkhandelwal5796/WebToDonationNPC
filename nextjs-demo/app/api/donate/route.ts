import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        // 1. Get the payload from the frontend request
        const payload = await request.json();

        // 2. Fetch OAuth Token from Salesforce
        const oauthUrl = "https://cloudcertitude-a.my.salesforce.com/services/oauth2/token";
        const clientId = process.env.SALESFORCE_CLIENT_ID;
        const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            console.error("Missing Salesforce credentials in .env.local");
            return NextResponse.json({ success: false, message: "Server configuration error" }, { status: 500 });
        }

        const oauthBody = new URLSearchParams();
        oauthBody.append('grant_type', 'client_credentials');
        oauthBody.append('client_id', clientId);
        oauthBody.append('client_secret', clientSecret);

        const oauthResponse = await fetch(oauthUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: oauthBody.toString()
        });

        if (!oauthResponse.ok) {
            console.error("Failed to authenticate with Salesforce.");
            return NextResponse.json({ success: false, message: "Failed to authenticate with Salesforce" }, { status: oauthResponse.status });
        }

        const oauthData = await oauthResponse.json();
        const accessToken = oauthData.access_token;

        // 3. Make the Donation API Call
        const sfEndpoint = "https://cloudcertitude-a.my.salesforce.com/services/apexrest/website/donate";
        const response = await fetch(sfEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const contentType = response.headers.get("content-type");
        let data = null;
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        }

        if (response.ok && data && data.success) {
            return NextResponse.json(data);
        } else {
            return NextResponse.json(
                { success: false, message: (data && data.message) ? data.message : "Unable to process donation. Please try again." },
                { status: response.status >= 400 ? response.status : 400 }
            );
        }
    } catch (error) {
        console.error("Backend Donation Error:", error);
        return NextResponse.json({ success: false, message: "Unable to process donation. Please try again." }, { status: 500 });
    }
}
