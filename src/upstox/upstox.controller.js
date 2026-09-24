const upstoxService = require('./upstox.service');

class UpstoxController {
  async login(req, res) {
    try {
      const state = req.query.state || '';

      const authorizationUrl =
        upstoxService.getAuthorizationUrl(state);

      return res.redirect(authorizationUrl);
    } catch (error) {
      console.error(
        'Upstox login error:',
        error.message,
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to start Upstox authentication',
      });
    }
  }

  async callback(req, res) {
    try {
      const { code, state } = req.query;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Authorization code missing',
        });
      }

      const tokenData =
        await upstoxService.exchangeCodeForToken(code);

      console.log(
        'Upstox authentication successful',
      );

      return res.json({
        success: true,
        message: 'Upstox authentication successful',
        state: state || null,

        // Temporary development response.
        accessToken: tokenData.access_token,
      });
    } catch (error) {
      console.error(
        'Upstox callback error:',
        error.response?.data || error.message,
      );

      return res.status(500).json({
        success: false,
        message: 'Upstox authentication failed',
        error:
          error.response?.data?.errors ||
          error.message,
      });
    }
  }
}

module.exports = new UpstoxController();