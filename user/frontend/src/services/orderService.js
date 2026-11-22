import { apiGet, apiPatch, apiPost } from "./apiClient.js";

export async function listAcceptedWholesalers(params) {
  return await apiGet("/wholesaler-links/accepted", { params });
}
export async function listActiveWholesalers(params) {
  return await apiGet("/wholesaler-links/active-wholesalers", { params });
}
export async function listIncomingMatchRequests(params) {
  return await apiGet("/wholesaler-links/incoming", { params });
}
export async function acceptMatchRequest(id, payload) {
  return await apiPost(`/wholesaler-links/${encodeURIComponent(String(id))}/accept`, payload || {});
}
export async function rejectMatchRequest(id, payload) {
  return await apiPost(`/wholesaler-links/${encodeURIComponent(String(id))}/reject`, payload || {});
}
export async function listWholesalerProducts(wholesalerAccountId, params) {
  return await apiGet(`/wholesaler-links/${encodeURIComponent(String(wholesalerAccountId))}/products`, { params });
}

export async function placeOrder(payload) {
  return await apiPost("/orders", payload || {});
}
export async function listMyOrders(params) {
  return await apiGet("/orders/my-orders", { params });
}
export async function listIncomingOrders(params) {
  return await apiGet("/orders/incoming", { params });
}
export async function getOrderById(id) {
  return await apiGet(`/orders/${encodeURIComponent(String(id))}`);
}
export async function getWholesalerOrderView(id) {
  return await apiGet(`/orders/${encodeURIComponent(String(id))}/wholesaler-view`);
}
export async function acceptOrder(id, payload) {
  return await apiPost(`/orders/${encodeURIComponent(String(id))}/accept`, payload || {});
}
export async function rejectOrder(id, payload) {
  return await apiPost(`/orders/${encodeURIComponent(String(id))}/reject`, payload || {});
}
export async function dispatchOrder(id) {
  return await apiPost(`/orders/${encodeURIComponent(String(id))}/dispatch`, {});
}
export async function cancelOrderRetailer(id, payload) {
  return await apiPost(`/orders/${encodeURIComponent(String(id))}/cancel`, payload || {});
}
export async function cancelOrderWholesaler(id, payload) {
  return await apiPost(`/orders/${encodeURIComponent(String(id))}/cancel-by-wholesaler`, payload || {});
}
export async function confirmDelivery(id) {
  return await apiPost(`/orders/${encodeURIComponent(String(id))}/confirm-delivery`, {});
}
export async function createPurchaseFromOrder(id, payload) {
  return await apiPost(`/orders/${encodeURIComponent(String(id))}/create-purchase`, payload || {});
}

export async function requestWholesalerLink(payload) {
  return await apiPost("/wholesaler-links/connect", payload || {});
}
export async function listMyWholesalerLinks() {
  return await apiGet("/wholesaler-links/my-connections");
}
export async function updateWholesalerLink(id, payload) {
  return await apiPatch(`/wholesaler-links/${encodeURIComponent(String(id))}`, payload || {});
}
