// Offline parser tests against saved composer-api samples. No browser/network.
import { readFileSync } from "fs";
import { parseSearch, parseDetails, parseReviews } from "../src/parse.js";

const load = (f) => JSON.parse(readFileSync(new URL(`../samples/${f}`, import.meta.url), "utf8"));
let failed = 0;
const check = (cond, msg) => {
  console.error(`${cond ? "  ok " : " FAIL"}  ${msg}`);
  if (!cond) failed++;
};

console.error("── parseSearch ──");
const s = parseSearch(load("search.json"), 12);
check(s.items.length > 0, `items: ${s.items.length}`);
const it = s.items[0];
console.error("   first:", JSON.stringify({ sku: it.sku, name: it.name?.slice(0, 40), price: it.price, rating: it.rating, reviews: it.reviews, url: !!it.url }));
check(!!it.sku, "item has sku");
check(typeof it.price === "number", "item price is number");
check(it.url?.startsWith("https://") && !it.url.includes("?"), "item url clean+absolute");
check(s.items.every((x) => x.price), "every item has a price");

console.error("── parseDetails ──");
const d = parseDetails(load("pdp.json"), load("pdp_page2.json"));
console.error("   ", JSON.stringify({ sku: d.sku, name: d.name?.slice(0, 40), price: d.price, priceRegular: d.priceRegular, oldPrice: d.oldPrice, available: d.available, seller: d.seller?.name, chars: Object.keys(d.characteristics).length, descText: d.description.text.length, descImgs: d.description.images.length, imgs: d.images.length }));
check(!!d.sku, "details has sku");
check(typeof d.price === "number", "details price is number");
check(!!d.name, "details has name");
check(d.images.length > 0, "details has images");
check(Object.keys(d.characteristics).length > 0, "details has characteristics");
check(d.description.text.length > 0 || d.description.images.length > 0, "details has description (text or images)");

console.error("── parseReviews ──");
const r = parseReviews(load("reviews.json"), 10);
console.error("   ", JSON.stringify({ rating: r.rating, total: r.totalReviews, count: r.count }));
check(r.reviews.length > 0, `reviews: ${r.reviews.length}`);
const rv = r.reviews.find((x) => x.comment) || r.reviews[0];
console.error("   sample:", JSON.stringify({ author: rv.author, score: rv.score, comment: rv.comment?.slice(0, 50), date: rv.date, purchased: rv.purchased }));
check(r.reviews.some((x) => typeof x.score === "number"), "reviews have scores");
check(r.reviews.some((x) => x.comment || x.pros || x.cons), "reviews have text");

console.error(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
