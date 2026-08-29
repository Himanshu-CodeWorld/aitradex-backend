module.exports = function classify(text) {

    const data = text.toLowerCase();

    if (

        data.includes("income tax department") ||

        data.includes("permanent account number")

    ) {

        return {

            success: true,

            documentType: "pan",

            message: "PAN Card Verified"

        };

    }

    if (

        data.includes("unique identification authority of india") ||

        data.includes("government of india")

    ) {

        if (

            data.includes("address") ||

            data.includes("1947") ||

            data.includes("uidai.gov.in")

        ) {

            return {

                success: true,

                documentType: "aadhaar_back",

                message: "Aadhaar Back Verified"

            };

        }

        return {

            success: true,

            documentType: "aadhaar_front",

            message: "Aadhaar Front Verified"

        };

    }

    return {

        success: false,

        documentType: null,

        message: "Unknown Document"

    };

};