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

        let mirroredToOrganization = false;
        let mirrorOrganizationId: string | number | null = null;

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

        const uploadsDir = join(process.cwd(), "uploads", "jobs", id);
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

        const relativePath = `uploads/jobs/${id}/${fileName}`;

        const apiUrl = process.env.API_BASE_URL || "http://localhost:8080";

        const jobDocResponse = await fetch(`${apiUrl}/api/jobs/${id}/documents`, {
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
        });

        const jobDocData = await jobDocResponse.json();

        if (!jobDocResponse.ok) {
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
                    message: jobDocData.message || "Failed to save document metadata",
                },
                { status: jobDocResponse.status }
            );
        }

        try {
            const jobResponse = await fetch(`${apiUrl}/api/jobs/${id}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            if (jobResponse.ok) {
                const jobData = await jobResponse.json();
                const job = jobData?.job;
                const organizationId =
                    job?.organization_id ?? job?.organizationId ?? job?.organization?.id;

                if (organizationId) {
                    mirrorOrganizationId = organizationId;
                    const mirrorResponse = await fetch(`${apiUrl}/api/organizations/${organizationId}/documents`, {
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
                    });

                    if (!mirrorResponse.ok) {
                        const mirrorData = await mirrorResponse
                            .json()
                            .catch(() => null);
                        console.error(
                            "Failed to mirror job document to organization:",
                            mirrorResponse.status,
                            mirrorData
                        );
                    } else {
                        mirroredToOrganization = true;
                    }
                }
            } else {
                const jobErr = await jobResponse.json().catch(() => null);
                console.error(
                    "Failed to fetch job for mirroring:",
                    jobResponse.status,
                    jobErr
                );
            }
        } catch (e) {
            console.error("Error mirroring job document to organization:", e);
        }

        return NextResponse.json({
            ...jobDocData,
            mirroredToOrganization,
            mirrorOrganizationId,
        });
    } catch (error) {
        console.error("Error uploading document:", error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}
