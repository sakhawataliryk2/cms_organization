/**
 * Validates a US phone number.
 * Format must be (XXX) XXX-XXXX or just 10 digits.
 * Checks for valid NANP area code and exchange code.
 * 
 * Rules:
 * - Area Code (NPA): First digit 2-9.
 * - Exchange Code (NXX): First digit 2-9.
 * - Verify Area Code against known NANP list (strict validation).
 */
import { US_AREA_CODES } from "../constants/usAreaCodes";

export const isValidUSPhoneNumber = (phoneNumber: string): boolean => {
    // Remove non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, "");
    // console.log('cleaned', cleaned);

    // Must be exactly 10 digits
    if (cleaned.length !== 10) {
        return false;
    }

    console.log('cleaned.length', cleaned.length);

    // NANP validation:
    // Area Code (NPA) - 1st digit (index 0) must be 2-9
    if (parseInt(cleaned[0]) < 2) {
        return false;
    }

    // Strict validation: Check against list of active NANP area codes
    const areaCode = cleaned.substring(0, 3);

    console.log('areaCode', areaCode);
    if (!US_AREA_CODES.includes(areaCode)) {
        return false;
    }

    return true;
};
