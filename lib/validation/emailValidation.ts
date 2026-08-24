export interface EmailValidationResult {
    isValid: boolean;
    message: string;
    suggestion?: string;
    deliverable?: boolean;
    riskLevel?: "low" | "medium" | "high";
    result?: string;
    configured?: boolean;
}

const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const validateEmailFormat = (email: string): EmailValidationResult => {
    const trimmed = String(email || "").trim();
    if (!trimmed) {
        return {
            isValid: false,
            message: "Email address is required",
        };
    }

    if (!emailRegex.test(trimmed)) {
        return {
            isValid: false,
            message: "Please enter a valid email format",
        };
    }

    return {
        isValid: true,
        message: "Email format is valid",
    };
};

export const validateEmail = async (email: string): Promise<EmailValidationResult> => {
    const formatValidation = validateEmailFormat(email);
    if (!formatValidation.isValid) {
        return formatValidation;
    }

    try {
        const response = await fetch("/api/validate/email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ email }),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok || !data) {
            throw new Error(data?.message || "Email validation API error");
        }

        return {
            isValid: data.isValid !== false && data.blocked !== true,
            message: data.message || formatValidation.message,
            suggestion: data.suggestion || undefined,
            deliverable: data.deliverable,
            riskLevel: data.riskLevel,
            result: data.result,
            configured: data.configured,
        };
    } catch (error) {
        console.error("Email validation service error:", error);
        return {
            isValid: true,
            message: "Email validation service temporarily unavailable",
            riskLevel: "medium",
        };
    }
};
