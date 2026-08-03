import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

export async function POST(request: Request) {
    try {
        const { amount } = await request.json();

        const key_id = process.env.RAZORPAY_KEY_ID;
        const key_secret = process.env.RAZORPAY_KEY_SECRET;

        if (!key_id || !key_secret) {
            console.error("Missing Razorpay credentials in .env.local");
            return NextResponse.json({ success: false, message: "Server configuration error" }, { status: 500 });
        }

        const razorpay = new Razorpay({
            key_id: key_id,
            key_secret: key_secret
        });

        // Amount is in smallest currency unit (cents). Using USD as per the form design.
        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: 'receipt_' + Date.now()
        });

        return NextResponse.json({ success: true, orderId: order.id, keyId: key_id });
    } catch (error) {
        console.error("Razorpay Order Creation Error:", error);
        return NextResponse.json({ success: false, message: "Could not create payment order" }, { status: 500 });
    }
}
