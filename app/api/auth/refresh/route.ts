import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { token } = body;

        if (!token) {
            return NextResponse.json(
                { success: false, message: 'No token provided' },
                { status: 400 }
            );
        }

        try {
            // Verify the current token
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET || 'your-secret-key'
            ) as jwt.JwtPayload;

            // Generate a new token with a new expiration
            const newToken = jwt.sign(
                {
                    userId: decoded.userId,
                    email: decoded.email,
                    userType: decoded.userType
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '7d' }
            );

            // Return the new token
            return NextResponse.json({
                success: true,
                token: newToken
            });
        } catch (jwtError) {
            console.error('JWT verification error:', jwtError);
            return NextResponse.json(
                {
                    success: false,
                    message: 'Invalid token',
                    error: jwtError instanceof Error ? jwtError.message : String(jwtError)
                },
                { status: 401 }
            );
        }
    } catch (error) {
        // Don't log SyntaxError for JSON parsing - this is expected when request body is invalid
        if (!(error instanceof SyntaxError)) {
            console.error('Error refreshing token:', error);
        }
        return NextResponse.json(
            {
                success: false,
                message: 'Error refreshing token',
                error: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        );
    }
}