// Optional metadata reads retain compatibility during rolling schema upgrades.
export async function checkoutMenu(db, ids, source) {
  return db.query(`SELECT m.id,m.name,m.price,
    (m.is_available IS NOT FALSE AND c.is_active IS NOT FALSE
      AND to_jsonb(m)->>'deleted_at' IS NULL AND to_jsonb(c)->>'deleted_at' IS NULL
      AND COALESCE((to_jsonb(m)->>$2)::boolean,true)) AS is_available
    FROM menu m JOIN categories c ON c.id=m.category_id
    WHERE m.id=ANY($1::int[]) FOR SHARE OF m,c`,
    [ids,source==='kiosk'?'visible_kiosk':'visible_website']);
}
export function checkQuotedPrices(items, rows) {
  const prices=new Map(rows.map(row=>[Number(row.id),Number(row.price)]));
  for(const item of items) {
    if(item.expected_unit_price==null)continue;
    const expected=Number(item.expected_unit_price), actual=prices.get(Number(item.menu_id||item.menu_item_id));
    if(!Number.isFinite(expected)||Math.round(expected*100)!==Math.round(actual*100)) {
      throw Object.assign(new Error('Menu prices changed. Please review your cart and try again.'),{statusCode:409,code:'MENU_PRICE_CHANGED'});
    }
  }
}
