import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const cookieStore = await cookies();
        const token = cookieStore.get("token")?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: "Authentication required" },
                { status: 401 }
            );
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const documentName = formData.get("document_name") as string;
        const documentType = (formData.get("document_type") as string) || "General";

        if (!file) {
            return NextResponse.json(
                { success: false, message: "File is required" },
                { status: 400 }
            );
        }

        const allowedTypes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "image/jpeg",
            "image/png",
            "image/gif",
        ];
        const isValidType =
            allowedTypes.includes(file.type) ||
            file.name.match(/\.(pdf|doc|docx|txt|jpg|jpeg|png|gif)$/i);

        if (!isValidType) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Invalid file type. Allowed: PDF, DOC, DOCX, TXT, JPG, PNG, GIF",
                },
                { status: 400 }
            );
        }

        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { success: false, message: "File size exceeds 10MB limit" },
                { status: 400 }
            );
        }

        const uploadsDir = join(process.cwd(), "uploads", "placements", id);
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
        }

        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const fileName = `${timestamp}_${sanitizedName}`;
        const filePath = join(uploadsDir, fileName);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        const relativePath = `uploads/placements/${id}/${fileName}`;

        const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

        const placementDocResponse = await fetch(
            `${apiUrl}/api/placements/${id}/documents`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    document_name: documentName || file.name,
                    document_type: documentType,
                    file_path: relativePath,
                    file_size: file.size,
                    mime_type: file.type,
                }),
            }
        );

        const placementDocData = await placementDocResponse.json();

        if (!placementDocResponse.ok) {
            try {
                const fs = require("fs");
                if (existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (deleteError) {
                console.error(
                    "Error deleting file after failed save:",
                    deleteError
                );
            }

            return NextResponse.json(
                {
                    success: false,
                    message:
                        placementDocData.message ||
                        "Failed to save document metadata",
                },
                { status: placementDocResponse.status }
            );
        }

        return NextResponse.json(placementDocData);
    } catch (error) {
        console.error("Error uploading document:", error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
