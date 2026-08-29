const paddle = require("../services/paddle.service");

const classify = require("../services/classify.service");

exports.verifyDocument = async (req, res) => {

    try {

        if (!req.file) {

            return res.status(400).json({

                success: false,

                message: "Image required"

            });

        }

        const text = await paddle.extractText(

            req.file.path

        );

        const result = classify(text);

        return res.json({

            success: result.success,

            message: result.message,

            documentType: result.documentType,

            text

        });

    }

    catch (e) {

        console.log(e);

        return res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

};