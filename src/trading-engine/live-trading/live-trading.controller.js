'use strict';
const service = require('./live-trading.service');
function user(req,res) {
  const id = service.uid(req);
  if (!id) { res.status(401).json({ success:false, message:'Authentication required.' }); return null; }
  return id;
}
function fail(res,e) {
  const msg = e?.message || 'Live trading request failed.';
  const status = /disabled|not configured|connection|token|unavailable/i.test(msg) ? 503 :
    /not found/i.test(msg) ? 404 : /required|Invalid|Only |must |expired|already|moved|cannot|between|whole number|valid /i.test(msg) ? 400 : 502;
  res.status(status).json({ success:false, message:msg });
}
exports.preview = async (req,res) => {
  try { const id=user(req,res); if(!id)return; res.status(201).json({success:true,data:await service.createPreview(id,req.body||{})}); }
  catch(e){fail(res,e);}
};
exports.confirm = async (req,res) => {
  try { const id=user(req,res); if(!id)return; res.status(200).json({success:true,message:'Live order submitted to Upstox. Verify its exchange status.',data:await service.confirmOrder(id,req.body?.previewId,req.body?.confirmationPhrase)}); }
  catch(e){fail(res,e);}
};
exports.orders = async (req,res) => {
  try { const id=user(req,res); if(!id)return; const [brokerOrders, localOrders]=await Promise.all([service.orderBook(id),service.localHistory(id,req.query.limit)]); res.json({success:true,data:{brokerOrders,localOrders}}); }
  catch(e){fail(res,e);}
};
exports.details = async (req,res) => {
  try { const id=user(req,res); if(!id)return; res.json({success:true,data:await service.orderDetails(id,req.params.orderId)}); }
  catch(e){fail(res,e);}
};
exports.cancel = async (req,res) => {
  try { const id=user(req,res); if(!id)return; res.json({success:true,message:'Cancellation request sent. Confirm final status in the order book.',data:await service.cancelOrder(id,req.params.orderId)}); }
  catch(e){fail(res,e);}
};
