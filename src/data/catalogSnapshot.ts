/**
 * Catalog snapshot — REAL products pulled from circularfash.com/products.json.
 * A static stand-in for the live Storefront API (the seam swaps this out later).
 * Photos are the store's own Shopify CDN images. Regenerate with _gen.js.
 *
 * Only real fields are stored: price, compare-at, availability, variant size/
 * color, and the store's own description copy. No invented discounts/grades.
 */
import type { Product } from '../types/product';

export const CATALOG: Product[] = [
  {
    "id": "cf-10111428624712",
    "brand": "Gucci",
    "title": "Clutch Bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6740214D-6A8C-40BE-A882-EB9AA0777784.jpg?v=1782402536&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/B763148E-49FF-4CAE-AFAE-5E28BBF8C098.jpg?v=1782402538&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D9D19315-DDF1-4242-A019-494C58D2C359.jpg?v=1782402535&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/ECA1900F-7540-4A88-97E5-1262ABEEEC9F.jpg?v=1782402539&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E33F5A04-F8FB-42DF-8674-72722D59DC4D.jpg?v=1782402537&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/FA5C9745-2286-44F1-BE7F-27380D472BF9.jpg?v=1782402536&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/669686B8-4AF3-4EC5-AF74-BD077DBE4D97.jpg?v=1782402536&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D7E4A7BE-BFD1-4E78-B7DF-016074F2E692.jpg?v=1782402537&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/40D61837-2E75-40F1-894F-819FEC635038.jpg?v=1782402536&width=900"
    ],
    "price": 1700,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": false,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-624712",
    "createdAt": "2026-06-24T16:43:37+02:00",
    "description": "Code of the product 014.115.6088",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112441647432",
    "brand": "Gucci",
    "title": "GG Web Belt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CBA44164-16D5-4CF9-9383-2BBF0A53C063.jpg?v=1782401707&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2DBB100B-B853-42FD-8681-209C66EF2057.jpg?v=1782401708&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/BD6DCE7E-33DC-431A-881B-F23F75B506F0.jpg?v=1782401707&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/39C86DF4-235E-4AB9-BCB1-783C15782A04.jpg?v=1782401708&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F2976AB6-121D-4B7A-B41B-9B2E2D078E18.jpg?v=1782401707&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/1EC11E28-DFD1-4794-B587-80C264390B34.jpg?v=1782401708&width=900"
    ],
    "price": 2000,
    "compareAtPrice": 4800,
    "size": "95",
    "availableForSale": true,
    "isNew": true,
    "category": "Belts",
    "sku": "CF-647432",
    "createdAt": "2026-06-26T00:36:07+02:00",
    "description": "Size 95 Fits W33-37 -Comes With Dustbag",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112406290760",
    "brand": "Prada",
    "title": "Vela Nylon Messenger Bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/28DCFAEC-4522-440F-B9FD-B5F3B39DA8EA.jpg?v=1782423656&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/153273C2-B701-477D-94E2-5BF657AAE335.jpg?v=1782423663&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D222E70F-ECAF-4719-8117-F1DCCF8B0DDA.jpg?v=1782423656&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/1030A380-4094-473F-A458-6C3D05A18EF4.jpg?v=1782423656&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/4F724B54-A073-47AA-B185-338170619861.jpg?v=1782423663&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/22D393F2-F367-46A5-815C-46B03CBA1104.jpg?v=1782423663&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/91F980A8-495E-43F6-B843-74960EB14D66.jpg?v=1782423663&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/C3D24723-A6B0-4179-A0CD-593BCDD2D407.jpg?v=1782423663&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/3907E111-CD7A-454A-97D1-D46A800E27E3.jpg?v=1782423666&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/44F02D39-9089-42B9-95D7-C6CBED00B0E5.jpg?v=1782423664&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/1A53B7B1-31E4-4747-81D1-D8019B4E86DB.jpg?v=1782423663&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/13BEB84C-7E02-43C7-A266-293E47040DEE.jpg?v=1782423660&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E6103937-348A-4278-AC42-91A268AE59ED.jpg?v=1782423656&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D398C6BC-77D2-4794-A775-82CAB6F9A1AD.jpg?v=1782423656&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/04216C8B-8C9B-4CEF-BDF9-53455DDC7E13.jpg?v=1782423664&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/8F0561C1-D2B3-4B02-A27D-4F4493BFEF71.jpg?v=1782423656&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/FF0DC403-AD40-4BC3-A66D-54ECC9380935.jpg?v=1782423656&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/49DB9295-6DA2-4064-B11A-74A43DF94EDC.jpg?v=1782423664&width=900"
    ],
    "price": 2500,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-290760",
    "createdAt": "2026-06-25T23:35:31+02:00",
    "description": "Very good condition Slight wear on the corner of the logo and on the zippers Some parts inside have been sewn by previous owner",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112311329096",
    "brand": "Gucci",
    "title": "GG Supreme Shoulder Bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/8BB0FFE0-4941-474E-8C8B-A95FB5A82D76.jpg?v=1782415471&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/BBED788E-B359-4397-AE34-725AB1D96E2D.jpg?v=1782415468&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/06C2AB57-0404-4DB8-8637-A6E1BAACC84B.jpg?v=1782415468&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/81119E0C-EB41-4ACB-91A8-4C19DF4C6FBF.jpg?v=1782415472&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/DE360DCC-91B6-45E0-B3A4-B51B7D6784B9.jpg?v=1782415472&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E58BAF3E-D83C-4017-B0A6-D58F23C18A91.jpg?v=1782415468&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/401533B4-50FD-4D0C-AA77-BDE7DF039282.jpg?v=1782415469&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/123A239C-92E6-4E0B-B626-DE54F96534E2.jpg?v=1782415471&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/C49E9C55-CF47-4E8C-9236-5C1EBBF6ED2A.jpg?v=1782415471&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E2BF3219-6896-4CAB-9FFE-B983770D2322.jpg?v=1782415472&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/BCD546A2-86C9-4A1F-BDF8-0B2235529256.jpg?v=1782415469&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D932D92A-FA91-441A-9C92-268377F66450.jpg?v=1782415469&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/56821B7F-3E92-4C1D-9909-ECB2686EFC50.jpg?v=1782415472&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/49038A53-B61F-49D7-966A-6AE6173FF726.jpg?v=1782415472&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/217C3628-1102-4456-A114-45B5EB28FEC4.jpg?v=1782415472&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5E7DA13D-32E7-4DF7-B4E4-24C1A53C72C1.jpg?v=1782415468&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F478FAC2-70A8-4BC3-8328-95030E589034.jpg?v=1782415472&width=900"
    ],
    "price": 3000,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-329096",
    "createdAt": "2026-06-25T21:23:50+02:00",
    "description": "Some decoloration around the zippers but otherwise excellent condition",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111371805000",
    "brand": "Gucci",
    "title": "Canvas Jolicoeur",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/FullSizeRender_6e9fe1df-c61f-4707-a7a3-d9ab18b8a13b.heic?v=1782414368&width=900"
    ],
    "price": 3200,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": false,
    "isNew": true,
    "category": "Other",
    "sku": "CF-805000",
    "createdAt": "2026-06-24T16:20:50+02:00",
    "description": "Comes with 2 charms Outside ans Inside in perfect condition Pocket inside with a zip and a smaller one",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112308740424",
    "brand": "Gucci",
    "title": "GG Canvas Messenger Bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/218FE214-15C7-4DE1-B1C9-F7F98BD3EF98.jpg?v=1782413918&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/7BDECC41-A0BC-42A9-B134-14413F76BE1C.jpg?v=1782413918&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D67B1574-99CD-4297-AFE3-FE8190E8C57A.jpg?v=1782413918&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A6157B9E-A3A6-4AE3-96A0-7A0D67599206.jpg?v=1782413918&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/1938B2AB-77F0-4DC8-BA13-DD590C47D9C2.jpg?v=1782413918&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/00C74E28-F6BC-424D-B5A4-26D8B772C8E6.jpg?v=1782413918&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/1F3A4D06-3118-4443-B87E-B83F7886410F.jpg?v=1782413919&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/35454A79-FF83-4010-A3E3-3F492B7931D5.jpg?v=1782413919&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/97382792-87A5-4136-8522-56C29E08F044.jpg?v=1782413918&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2E44422D-CACD-4524-AB88-C7D402F27F38.jpg?v=1782413918&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6DC42131-F5B3-422B-BEFF-C79369FB6A08.jpg?v=1782413921&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/FA33C259-73CB-46E3-A558-0E9E94A6711A.jpg?v=1782413919&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EE11B0E0-2359-416D-AC3B-671897B26118.jpg?v=1782413919&width=900"
    ],
    "price": 1500,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": false,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-740424",
    "createdAt": "2026-06-25T20:56:24+02:00",
    "description": "Good condition General wear",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112306217288",
    "brand": "Gucci",
    "title": "Messenger Bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/831A196D-220E-41C0-AD68-EFD277E69A7A.jpg?v=1782413191&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/08647815-0979-45E8-A93C-223D90356A44.jpg?v=1782413191&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/B442AF10-3D04-44BD-BC76-863DDD3FA1A4.jpg?v=1782413191&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/DBCE787A-678C-49DF-BDFC-977DD86ABAE6.jpg?v=1782413191&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/66F62049-AC8F-4F6A-8131-B3D895111CB1.jpg?v=1782413191&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5A505BBF-BCA5-43B1-83C4-08415E0B6584.jpg?v=1782413191&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/1AFCDDF8-CB66-4077-977A-C062CEFF83AE.jpg?v=1782413192&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/15021849-6165-4FEC-8BE8-FB1172466CC8.jpg?v=1782413191&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2B104B1E-6592-4847-A20E-8F583D4611D2.jpg?v=1782413191&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/26E580FC-3FE7-4889-9F15-9D9BFA39485B.jpg?v=1782413191&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/222B8229-C938-45D0-BA3D-E39158C236C0.jpg?v=1782413192&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E29C7109-4D2B-414B-8958-2FC8E530A8E6.jpg?v=1782413191&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/78D17194-5245-479D-B0B2-9EC6C3090102.jpg?v=1782413191&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CFC8A886-F269-40AB-B71E-2BF3FFE748D3.jpg?v=1782413194&width=900"
    ],
    "price": 2700,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-217288",
    "createdAt": "2026-06-25T20:45:09+02:00",
    "description": "The shoulder strap is adjustable There is a pocket on the outside of the bag without a zip The inside of the bag is perfect and it has another pocket inside",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111398838600",
    "brand": "Gucci",
    "title": "Belt Bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/ADED83A2-580A-4F0E-9098-A1F6A6859948.jpg?v=1782411554&width=900"
    ],
    "price": 2700,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": false,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-838600",
    "createdAt": "2026-06-24T16:29:59+02:00",
    "description": "Comes with the authentic strap Corners of the leather wears",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112160137544",
    "brand": "Gucci",
    "title": "Wool Beanie",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6879D642-06FB-4158-BDEC-15001024FF08.jpg?v=1782402018&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/DAD60C98-4947-4694-8099-3744B17FE021.jpg?v=1782402018&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/50B38BF9-D3C1-48CA-92BE-A9FD1C8E87FA.jpg?v=1782402018&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F45376BE-3771-4F98-BA37-2106766E6C6D.jpg?v=1782402019&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/989F52AC-E5AA-4F39-9332-5AAE891DF2D6.jpg?v=1782402018&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2125633A-C1B5-4735-9C4D-523B49DAB553.jpg?v=1782402018&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/717742EB-D7AD-4EAE-B84B-1F258407202C.jpg?v=1782402018&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/B634192A-AED5-48A5-86E8-14E9C0D521E8.jpg?v=1782402018&width=900"
    ],
    "price": 1800,
    "compareAtPrice": 3000,
    "size": null,
    "availableForSale": false,
    "isNew": true,
    "category": "Hats",
    "sku": "CF-137544",
    "createdAt": "2026-06-25T17:40:02+02:00",
    "description": "Like new comes with Box",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112156795208",
    "brand": "Gucci",
    "title": "Tiger Bengal Belt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E40BCDD2-6D69-49BC-A6A9-9E505FE92764.jpg?v=1782401972&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/848A50FA-41E9-47B4-B276-6B203B44F8BD.jpg?v=1782401972&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/8ADDE692-1DD2-46C7-BD58-5AAD8086A7C0.jpg?v=1782401972&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/898B5C7F-F501-4EEC-87A3-07B9C331F1C7.jpg?v=1782401973&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F493D270-699F-46A3-B357-FF6F6EB144F3.jpg?v=1782401972&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/0FBAF7FA-F4B0-4566-8021-C9FECBB67A28.jpg?v=1782401972&width=900"
    ],
    "price": 2600,
    "compareAtPrice": 5000,
    "size": "90",
    "availableForSale": true,
    "isNew": true,
    "category": "Belts",
    "sku": "CF-795208",
    "createdAt": "2026-06-25T17:38:53+02:00",
    "description": "Size 90 Fits W32-36 Comes with Box & Dustbag",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112154763592",
    "brand": "Gucci",
    "title": "GG Belt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/41A5E762-664A-4B01-97BF-948ACB8F67AA.jpg?v=1782401910&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F57FE198-226C-46E8-A48E-B29800F8A9C0.jpg?v=1782401910&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/9473537C-2E1C-4BD3-B02D-8CCFFC89C4CE.jpg?v=1782401910&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6F296EBC-9D31-40DE-9F8F-55103D6BB30B.jpg?v=1782401909&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/07CBB7D5-5818-4385-8C0A-AAEB7E7E419E.jpg?v=1782401910&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/753B3ED2-BE22-4AE3-AFB2-2DEEEA5257D7.jpg?v=1782401909&width=900"
    ],
    "price": 2000,
    "compareAtPrice": 3800,
    "size": "95",
    "availableForSale": false,
    "isNew": true,
    "category": "Belts",
    "sku": "CF-763592",
    "createdAt": "2026-06-25T17:38:05+02:00",
    "description": "Size 95 Fits W34-38 Comes with Box & Dustbag",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112152928584",
    "brand": "Gucci",
    "title": "GG Supreme Belt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/0EF4F988-EF81-40F2-A417-00EB44C69976.jpg?v=1782401837&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/94E9A770-3DE1-4090-B421-9D4FBF83CDC0.jpg?v=1782401838&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/943BAB88-64D9-421C-9293-6452FA0CF240.jpg?v=1782401838&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/B59151CE-0444-47D0-9F45-810B6A58B4D3.jpg?v=1782401837&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/36275BEF-0DEA-442D-8B32-EEF109A66EEF.jpg?v=1782402780&width=900"
    ],
    "price": 2200,
    "compareAtPrice": 4800,
    "size": "85",
    "availableForSale": true,
    "isNew": true,
    "category": "Belts",
    "sku": "CF-928584",
    "createdAt": "2026-06-25T17:36:47+02:00",
    "description": "Size 85 fits W29-33 -Comes with Box & Dustbag",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112150045000",
    "brand": "Louis Vuitton",
    "title": "Keep It Bracelet",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F10990B0-0D5C-4D00-B912-0A19196192FF.jpg?v=1782401625&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/30496FE4-A755-4D28-B14F-A8498F4BE672.jpg?v=1782401626&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D26EFD50-1EAB-4EA1-9AFE-2081D92254C5.jpg?v=1782401624&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/09F616DF-896B-4139-8609-F03D2B9A86A8.jpg?v=1782401623&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/BF40F7CC-D9CC-4CE8-8BC8-70980C245822.jpg?v=1782401624&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EBD88877-37C7-4CC2-8C52-2B16E07C503B.jpg?v=1782401624&width=900"
    ],
    "price": 1800,
    "compareAtPrice": 2700,
    "size": "21",
    "availableForSale": false,
    "isNew": true,
    "category": "Accessories",
    "sku": "CF-045000",
    "createdAt": "2026-06-25T17:33:23+02:00",
    "description": "Comes with Box & Dustbag",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112148078920",
    "brand": "Moncler",
    "title": "Kenya Field Jacket",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/9F08BD86-F6BA-4F8B-8FB8-AC480930C640.jpg?v=1782401463&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6965A7C3-F73B-41D1-ACE7-23C3A89DA655.jpg?v=1782401463&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2E13F4A8-8ED3-4CFF-85EA-EBD263229AA1.jpg?v=1782401463&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6E9C38F5-7AF4-4F37-8D41-5EE15A5F2DF9.jpg?v=1782401464&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/46C05D5C-D5A5-4423-B641-BDC58D0CB7AD.jpg?v=1782401464&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/34BE0BBD-BA0F-4460-946D-AA062A410BCE.jpg?v=1782401463&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6DC18D95-D2FD-4211-A1EE-6BD36F3E3FCA.jpg?v=1782401463&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/92945109-4995-4B09-87E8-175350B0B268.jpg?v=1782401463&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/72D699A4-FD87-4978-BCAD-C29B1BF8C3D6.jpg?v=1782401464&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5A4AEEE0-E612-4619-BCC8-9DFEE574EADF.jpg?v=1782401463&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EF38604D-6978-4423-B7CF-2AE0210060F4.jpg?v=1782401463&width=900"
    ],
    "price": 1700,
    "compareAtPrice": 6000,
    "size": "XL",
    "availableForSale": false,
    "isNew": true,
    "category": "Outerwear",
    "sku": "CF-078920",
    "createdAt": "2026-06-25T17:30:38+02:00",
    "description": "Size 5/XL",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112147194184",
    "brand": "Moncler",
    "title": "Charles Lightweight Jacket",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EEBCFE71-048C-4BEC-A42B-6B6223DFD8DF.jpg?v=1782401393&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/4EE53FAD-0943-4987-AB51-C12D8B3E2FEE.jpg?v=1782401393&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5726EFE2-0899-4AE6-AADD-213ED791DAF7.jpg?v=1782401394&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/9071C720-6FB0-4A1E-B73F-42EF0B66A7F8.jpg?v=1782401394&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E80E7C70-4DAB-4BAD-B088-66F8E39EF50D.jpg?v=1782401394&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/18590DE4-21DB-4E41-B9FF-66FE59640DDA.jpg?v=1782401394&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F7245B46-354D-4588-9F80-936E4297F0B9.jpg?v=1782401394&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/FAA50E01-12B8-435A-890E-5C049FBDDB99.jpg?v=1782401394&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/BCE84105-6E41-4E49-AA4F-464B0D456C72.jpg?v=1782401393&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A7A24774-3A62-45FC-BD1E-5875C6788D31.jpg?v=1782401394&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/C72A4EB2-77E7-4F3A-9198-F39921F7154E.jpg?v=1782401394&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/AC7DD7B7-BEBB-4654-AD0E-4572A668AA59.jpg?v=1782401394&width=900"
    ],
    "price": 1700,
    "compareAtPrice": 7000,
    "size": "M",
    "availableForSale": false,
    "isNew": true,
    "category": "Outerwear",
    "sku": "CF-194184",
    "createdAt": "2026-06-25T17:29:16+02:00",
    "description": "Very Good Condition, Just missing the left front button -Size 4/Medium",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112146866504",
    "brand": "Moncler",
    "title": "Gui Vest",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/DD442619-DA8A-4326-B6DF-6CCDDB8E613D.jpg?v=1782401335&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/396F747F-7157-4C0C-A037-484221C104F9.jpg?v=1782401335&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/21755855-5D29-4443-BBD0-BF13F0F1A8A4.jpg?v=1782401337&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CC396C75-987D-4B9F-A925-5E0F12750E0C.jpg?v=1782401335&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/69712881-20DB-40A8-A5F1-2559E30643F6.jpg?v=1782401335&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D0DE195A-536D-4F12-9512-003271A35DC7.jpg?v=1782401335&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/3B9C34EE-3112-4CDF-8403-97C767B3E0CD.jpg?v=1782401335&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/4AEA92B0-431F-4DD4-9ECC-C874B6E93E3D.jpg?v=1782401336&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EDC3D9A0-9049-49CA-BBC4-53096B7E1FDD.jpg?v=1782401336&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5D5DE153-2F3D-4AC5-8788-75FEC30B1FBD.jpg?v=1782401335&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/383B9160-A3C6-4272-818E-96B6C77E1029.jpg?v=1782401335&width=900"
    ],
    "price": 3300,
    "compareAtPrice": 9300,
    "size": "M",
    "availableForSale": false,
    "isNew": true,
    "category": "Outerwear",
    "sku": "CF-866504",
    "createdAt": "2026-06-25T17:28:26+02:00",
    "description": "Like new without tags",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112144376136",
    "brand": "Stone Island",
    "title": "Shadow Project Sweatshirt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D503C3A9-544F-4061-80CD-89A842CF12CC.jpg?v=1782401168&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/36D73B37-CB4C-4E76-B45C-335603EE6E1A.jpg?v=1782401167&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/7DC3141A-DAFB-4C68-BC88-FB5DEFDC7BE6.jpg?v=1782401168&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/98ED38A4-653A-49AF-8980-FF93FC3B02EF.jpg?v=1782401167&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/46529655-446E-45D4-A49A-60E74141A798.jpg?v=1782401168&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/4A97EF87-798F-4F95-997D-7A2DDFC40F24.jpg?v=1782401168&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/871CA76F-8B4A-4FFA-A587-72391EB3DDF5.jpg?v=1782401168&width=900"
    ],
    "price": 1200,
    "compareAtPrice": 4000,
    "size": "S",
    "availableForSale": true,
    "isNew": true,
    "category": "Knitwear",
    "sku": "CF-376136",
    "createdAt": "2026-06-25T17:25:40+02:00",
    "description": "Big Print at the Back Side",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112144048456",
    "brand": "Moncler",
    "title": "Tricolor Zip Hoodie",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/260975CE-8DF4-41C1-BFDF-36B1580D2D11.jpg?v=1782401116&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/B5052142-30D1-41F6-AEA6-0B5C0D6B9CE6.jpg?v=1782401117&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/34F8F9D1-7E32-4EDB-A2CE-DB27694FB506.jpg?v=1782401116&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/C99314B1-F05E-481F-BB3D-E0C76E31B56D.jpg?v=1782401116&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/351C0E47-F2C6-4305-848A-DBF09149C939.jpg?v=1782401116&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/C98888BD-D972-458F-AE36-465954BE5F71.jpg?v=1782401117&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F1002DAB-1FCD-43E6-80E5-071B0B5E454C.jpg?v=1782401116&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6FC46FE2-B81B-4ABF-AAEF-CA2A6C4FC2A6.jpg?v=1782401116&width=900"
    ],
    "price": 2000,
    "compareAtPrice": 7000,
    "size": "XL",
    "availableForSale": true,
    "isNew": true,
    "category": "Knitwear",
    "sku": "CF-048456",
    "createdAt": "2026-06-25T17:24:50+02:00",
    "description": "-Tricolor Detailing at the Hood & Cuffs",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112143655240",
    "brand": "Moncler",
    "title": "Tricolor Zip Hoodie",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/BD4F3363-A00E-4861-890C-50D9EE7D072A.jpg?v=1782401074&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/11B44E3B-2035-4410-BE14-FFA5C89DF055.jpg?v=1782401075&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/9D37A839-C74E-4127-A4FA-584B752341B4.jpg?v=1782401075&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F223909E-F565-4B1D-9B41-1C8AFC35418F.jpg?v=1782401076&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E0048F69-E739-4632-B8E4-9C5F4240E61E.jpg?v=1782401074&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A4CFE694-E92E-4BED-8A13-719134949770.jpg?v=1782401075&width=900"
    ],
    "price": 2000,
    "compareAtPrice": 7000,
    "size": "M",
    "availableForSale": false,
    "isNew": true,
    "category": "Knitwear",
    "sku": "CF-655240",
    "createdAt": "2026-06-25T17:24:01+02:00",
    "description": "-Tricolor Detailing at the Hood & Cuffs",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112142737736",
    "brand": "Moncler",
    "title": "Polo Shirt Yellow",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/718906B5-A772-4F17-AA23-99C2C96502E2.jpg?v=1782400976&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/1414B7C3-1F7D-42AB-AA04-CCFFFFBC5C6E.jpg?v=1782400977&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/25A73FB2-CFB6-44F1-86A4-745CAD90082B.jpg?v=1782400978&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2BD01F17-193B-4269-9ADC-D2C55C7E7C7D.jpg?v=1782400977&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/318E1EF9-4863-4A58-B26D-CD11EC521C99.jpg?v=1782400977&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/054ADB70-1B30-4435-B187-D83BC39549A7.jpg?v=1782400976&width=900"
    ],
    "price": 1000,
    "compareAtPrice": 3600,
    "size": "XL",
    "availableForSale": true,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-737736",
    "createdAt": "2026-06-25T17:19:58+02:00",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112142115144",
    "brand": "Moncler",
    "title": "Longsleeve Polo Shirt Navy (Fits L)",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E7C8B487-72D4-4CBF-83FE-382AA8532BF9.jpg?v=1782400900&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/621849D1-18B4-48A7-9815-88231261FE41.jpg?v=1782400900&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/4F318BE0-9FA2-47D9-A2BA-9196F6BCF7A1.jpg?v=1782400900&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2028B693-D01B-4B4E-B6EC-D2056EB65018.jpg?v=1782400901&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/4D4903D3-8E1C-442C-8C88-A15AC06BC0F5.jpg?v=1782400901&width=900"
    ],
    "price": 700,
    "compareAtPrice": 3900,
    "size": "XXL",
    "availableForSale": true,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-115144",
    "createdAt": "2026-06-25T17:18:18+02:00",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112141689160",
    "brand": "Moncler",
    "title": "Polo Shirt Royal Blue (Fits XS/S)",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/9DDF03CB-5430-44AD-80BD-0EBAD6B8405A.jpg?v=1782400426&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/B74379AD-ACA7-4651-93DC-EE666C0A9E95.jpg?v=1782400427&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F0E132EF-8DF8-4BF6-9664-80B39E6227F4.jpg?v=1782400426&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2EFF467C-1D03-4464-8715-7F18DF9FBBD6.jpg?v=1782400428&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/3F8D05CF-8190-4DE1-B707-290C40A003BE.jpg?v=1782400426&width=900"
    ],
    "price": 900,
    "compareAtPrice": 3600,
    "size": "M",
    "availableForSale": true,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-689160",
    "createdAt": "2026-06-25T17:16:18+02:00",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112140706120",
    "brand": "Moncler",
    "title": "Polo Shirt Grey (Fits M)",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/86E88605-F86B-483B-9023-66A931C6C3DE.jpg?v=1782400867&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/C67F3D52-426A-42E1-9000-903E18CEB384.jpg?v=1782400611&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/0D5B5DD2-5C3C-4E4F-81CC-E41F8F65F6D9.jpg?v=1782400610&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EE2280D6-797E-454F-BB23-ABE38567F82A.jpg?v=1782400610&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/7B150452-3836-4598-AD48-C01F1A365557.jpg?v=1782400611&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/61165D5F-F529-4A29-B174-2A11A5176A48.jpg?v=1782400611&width=900"
    ],
    "price": 1000,
    "compareAtPrice": 3600,
    "size": "L",
    "availableForSale": true,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-706120",
    "createdAt": "2026-06-25T17:12:55+02:00",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112140345672",
    "brand": "Moncler",
    "title": "Polo Shirt Blue",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/8B6733F3-DA89-407F-8FB5-81D976F912B2.jpg?v=1782400778&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/FA6743FE-F842-49BF-82B7-84479B367B5D.jpg?v=1782400778&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A952407D-5800-4082-BBBB-3F76B087A8CF.jpg?v=1782400778&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/457F40D3-2B77-4E3F-8223-5DA87CB3E92D.jpg?v=1782400777&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/4C2E23A2-5C36-4C78-9D1D-4897DEB922FC.jpg?v=1782400778&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F7354764-5FED-4C25-92AF-383B9725C46E.jpg?v=1782400778&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/825691E1-D099-4CDA-B3CB-93E5FDE4FF8F.jpg?v=1782400778&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/4809C57E-426A-4F8E-8B16-71B39D2EA1F5.jpg?v=1782400778&width=900"
    ],
    "price": 800,
    "compareAtPrice": 3600,
    "size": "L",
    "availableForSale": false,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-345672",
    "createdAt": "2026-06-25T17:11:32+02:00",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112139657544",
    "brand": "Moncler",
    "title": "Polo Shirt Blue (Fits S)",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/581F2A59-5B82-4B30-9BB6-1617C2194379.jpg?v=1782400720&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/94346BCB-515F-4DB7-8EF7-2FE9AAFDF37B.jpg?v=1782400721&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5E050536-B966-4C9F-BAFF-1A2D66FF49B4.jpg?v=1782400720&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D2E76883-E082-4248-BCA0-D3C43BF6F40E.jpg?v=1782400720&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2D430774-79EE-4286-A598-6F8ED633520A.jpg?v=1782400720&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F40CB208-FDB5-448E-AE64-5B26FB289E8F.jpg?v=1782400721&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/7F053BAA-5F0C-47EB-AFBB-E54A3AC2519B.jpg?v=1782400720&width=900"
    ],
    "price": 700,
    "compareAtPrice": 3600,
    "size": "M",
    "availableForSale": false,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-657544",
    "createdAt": "2026-06-25T17:08:26+02:00",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112139067720",
    "brand": "Moncler",
    "title": "Polo Shirt Navy (Fits XS/S)",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/BEDB10FD-A2D6-434A-8A4A-21510A3F544C.jpg?v=1782400849&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/52F7FD97-F3BB-47A1-B8CC-6F456518FD3B.jpg?v=1782400848&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/614381E0-33EC-4EA8-9EC3-4030670C7490.jpg?v=1782400849&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2905F7ED-9FF9-46D7-8CFB-964B19DB797D.jpg?v=1782400848&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E32084A8-6CEF-4744-8F1C-0A900C9E99A3.jpg?v=1782400849&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D0505D9D-0FF9-4005-993E-541C1F0A635D.jpg?v=1782400849&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EA600CF8-C704-4E01-B3B3-49C985C4AAA7.jpg?v=1782400853&width=900"
    ],
    "price": 700,
    "compareAtPrice": 3600,
    "size": "M",
    "availableForSale": false,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-067720",
    "createdAt": "2026-06-25T17:06:46+02:00",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112138576200",
    "brand": "Moncler",
    "title": "Polo Shirt Green",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EDEFFCC6-76D1-4968-9F91-707CE0116E00.jpg?v=1782400366&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/035DF752-127E-42C1-AB6C-3AABE72D09EF.jpg?v=1782400367&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/ED7EE5A6-8DF0-433F-8F09-A7ADC91803CF.jpg?v=1782400367&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/FCF1B8ED-C02B-4BD7-8783-E9982A0BEC90.jpg?v=1782400366&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/B5317D7F-7318-48CF-A82D-4AB973F221B0.jpg?v=1782400366&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/9C5868BA-EF42-4E48-AEC4-A7963F5B380D.jpg?v=1782400366&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/212E268E-85A1-45C1-BE62-60AA1A80FA4B.jpg?v=1782400366&width=900"
    ],
    "price": 800,
    "compareAtPrice": 3600,
    "size": "M",
    "availableForSale": true,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-576200",
    "createdAt": "2026-06-25T17:05:29+02:00",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112105840968",
    "brand": "Dsquared2",
    "title": "Cool Guy Jeans",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/C0784FAE-EE2E-4FF0-A9B0-F2CCBEC89806.jpg?v=1782400313&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/76CB65D0-F5B9-4161-85D3-9629881C2A02.jpg?v=1782400313&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/FCAC0099-38C5-4758-8B59-1631C85852D4.jpg?v=1782400313&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/87E44100-D53E-4397-B7A2-501EFD6CF0D7.jpg?v=1782400313&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E9C18A5B-4CD4-40D6-B97F-46DD7577DE15.jpg?v=1782400313&width=900"
    ],
    "price": 1200,
    "compareAtPrice": 7000,
    "size": "48",
    "availableForSale": true,
    "isNew": true,
    "category": "Bottoms",
    "sku": "CF-840968",
    "createdAt": "2026-06-25T16:27:55+02:00",
    "description": "Size 48",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112105808200",
    "brand": "Stone Island",
    "title": "Garment Jersey T-Shirt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E2322A6B-9C64-4B8B-8E12-41D6A8773114.jpg?v=1782406482&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/395D19AD-F2EF-45E2-97AA-20F254DC5C39.jpg?v=1782402634&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/C70F06C1-5FCA-4DD9-A557-131F314A9C70.jpg?v=1782402636&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F29D2703-76FB-4BFC-9FFA-E0CA8F1F59AC.jpg?v=1782402637&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/787EF411-5D35-4A66-A2D6-FAB8F570E722.jpg?v=1782402636&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E4D56914-90D1-4444-BD60-2C11B904FD6F.jpg?v=1782402635&width=900"
    ],
    "price": 500,
    "compareAtPrice": 1800,
    "size": "XL",
    "availableForSale": true,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-808200",
    "createdAt": "2026-06-25T16:27:45+02:00",
    "description": "The label on the inside has been cut off",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112105742664",
    "brand": "Stone Island",
    "title": "logo T-Shirt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D571AF2A-5300-4F15-AD12-B282FF0B7432.jpg?v=1782406461&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/00775032-DF11-4404-A122-E23F1CD2B231.jpg?v=1782402596&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/276B7550-F17F-40F0-8A41-D273FC6EEB91.jpg?v=1782402596&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/0D7F1E9D-0F57-4D15-8380-81C68F4B59CA.jpg?v=1782402596&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/70482035-F202-4E3F-8383-FD1F96820965.jpg?v=1782402596&width=900"
    ],
    "price": 700,
    "compareAtPrice": 2000,
    "size": "L",
    "availableForSale": true,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-742664",
    "createdAt": "2026-06-25T16:27:36+02:00",
    "description": "Logo in the front and on the back, refer to the pictures",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112089948488",
    "brand": "Burberry",
    "title": "Skirt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/AC3BEC1A-3163-47F7-909B-86A2DFB26ED7.jpg?v=1782396115&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E8843F33-44F3-4A26-BE99-D118A6827D28.jpg?v=1782396115&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/48F2B035-B2B4-44B8-A506-BC4F7630FDCB.jpg?v=1782396116&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A0FB0710-4826-464C-A450-4ECEF120841A.jpg?v=1782396115&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A4F77A39-D95F-457D-9892-3E59EEAB77C3.jpg?v=1782396115&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/03F6874F-4739-4524-BF20-C0A543BC25C6.jpg?v=1782396116&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/43EDB388-E6EA-40C7-B007-C4BFD6EF33FD.jpg?v=1782396115&width=900"
    ],
    "price": 500,
    "compareAtPrice": null,
    "size": "38",
    "availableForSale": true,
    "isNew": true,
    "category": "Other",
    "sku": "CF-948488",
    "createdAt": "2026-06-25T16:01:39+02:00",
    "description": "Skirt with the 6 original Burberry buttons Belt included with the skirt",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112089227592",
    "brand": "Chanel",
    "title": "Sunglasses",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/3E6A392B-3F80-4AE3-87AD-CAD57A7AE902.jpg?v=1782396019&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/7205C21F-67C3-4D9F-88FD-8204129D4AB9.jpg?v=1782396018&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A9B4D129-CB0C-4665-95F9-9CED503D4086.jpg?v=1782396019&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2C74297B-D3C1-4BB6-94C0-128D33842172.jpg?v=1782396019&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A457EDD7-3DA2-46C3-8B14-A51EDEEC67AC.jpg?v=1782396019&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6CDDB80B-3A7C-443E-97A4-061D9CDE198A.jpg?v=1782396019&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CCD3429D-623A-419B-B1AF-BAE4B2DAD554.jpg?v=1782396018&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/54DDE2C9-BA2A-44F0-8DF6-495F64E113BF.jpg?v=1782396019&width=900"
    ],
    "price": 2000,
    "compareAtPrice": 5000,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Accessories",
    "sku": "CF-227592",
    "createdAt": "2026-06-25T16:00:03+02:00",
    "description": "Comes with glasses box and explanatory paper N°C390089 Made in italy",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10112088965448",
    "brand": "Gucci",
    "title": "GG Supreme Long Wallet",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A0983980-01A0-47DB-B9B7-B6604F40D128.jpg?v=1782395978&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/25C870FB-9E73-4799-B99E-AA326063ABFC.jpg?v=1782395978&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6950710E-69AD-4433-909F-12BB079E3009.jpg?v=1782395978&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/3436144F-3F5E-42C5-BF66-442DF060D23B.jpg?v=1782395979&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/3155E472-647A-4759-B1BE-D909ABDB8D0B.jpg?v=1782395978&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/583E46CD-EE37-4AF6-A7F3-C4DE65920CAA.jpg?v=1782395978&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6E72945C-3FFB-45AC-9A39-7536ADAFFF41.jpg?v=1782395978&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CB4A7AC3-B007-48FF-B5D5-E380E7301C81.jpg?v=1782395978&width=900"
    ],
    "price": 920,
    "compareAtPrice": 3500,
    "size": null,
    "availableForSale": false,
    "isNew": true,
    "category": "Accessories",
    "sku": "CF-965448",
    "createdAt": "2026-06-25T15:59:20+02:00",
    "description": "Very good condition inside with 6 slots for bank cards, secure zipped pocket for coins and 3 large compartments to hold banknotes and documents.",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111431737672",
    "brand": "Gucci",
    "title": "Clutch Bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CBEA262C-BE9E-46E2-ADA8-47C8B83B3A88.jpg?v=1782403908&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/89067405-E58D-44C2-93E3-BD1D126CDBF8.jpg?v=1782403908&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CF6E4DB6-1FAE-4A87-803D-612362F2D4AA.jpg?v=1782403910&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EAE963B3-56BA-42F8-B8B7-09A564CDD5D0.jpg?v=1782403911&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F6713DD2-874D-4EED-B005-E3EC03BC58AE.jpg?v=1782403909&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5B4A2B45-5A7F-483B-BA7D-D1FFC992BD58.jpg?v=1782403908&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/41EB015A-0138-4C17-9505-604DA37FAF11.jpg?v=1782403910&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/675B8B1B-FC23-407E-9C22-52E083BF8D34.jpg?v=1782403910&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A5AC324B-591A-4507-AFFD-1BF71C7B12BC.jpg?v=1782403908&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/119B4EBE-FA47-471F-A46F-BB9C3D0A6082.jpg?v=1782403908&width=900"
    ],
    "price": 2000,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": false,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-737672",
    "createdAt": "2026-06-24T16:45:21+02:00",
    "description": "No defects",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111428428104",
    "brand": "Gucci",
    "title": "clutch bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/B0C9562D-387B-47E1-A050-C377FB806BE1.jpg?v=1782403738&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/26DB437F-54C5-4F2F-9CA2-7267A5B65C7F.jpg?v=1782403736&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/AC5D69E4-7487-4AAB-A990-77D23464121D.jpg?v=1782403737&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/079DB6C3-F3F3-4B09-85EC-98EB2E845198.jpg?v=1782403736&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/DF8E9CAE-7B25-40F8-A863-B1D84DB8298B.jpg?v=1782403736&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/42C85092-A49C-49E0-A47E-29702C8A918C.jpg?v=1782403736&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/8147E0CC-A9EC-4542-BF52-559332776EFB.jpg?v=1782403736&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/78F51D22-F722-4193-B93C-A20A2EB88674.jpg?v=1782403736&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F8CDBBE8-A27B-4F3D-8A4F-F2AE0276E4CC.jpg?v=1782403737&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A85EDD71-51D6-44BC-98F5-3090F9B05417.jpg?v=1782403736&width=900"
    ],
    "price": 2000,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-428104",
    "createdAt": "2026-06-24T16:42:53+02:00",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111428264264",
    "brand": "Gucci",
    "title": "PVC monogram clutch bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2725D0B5-AB9F-4F49-9CA1-955ECEC367CB.jpg?v=1782404047&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/82ADE5E3-2A50-4FFD-B215-65F4D832932E.jpg?v=1782404047&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/99AB8AC4-4FF4-47C3-92DE-78CB4E44DDB5.jpg?v=1782404047&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/8A62B454-DF25-424A-90B8-D5419043CCD2.jpg?v=1782404047&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/42E342DA-91BB-41D9-8152-4F1EDF64EF8C.jpg?v=1782404047&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CB04654E-DD73-41BA-84FF-D7F495E6173E.jpg?v=1782404047&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/AF563F50-02F1-4B9E-8A77-C73A9836129E.jpg?v=1782404047&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/1CADD1A1-5AD1-4C19-AD7A-615964E624A7.jpg?v=1782404047&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/ECDC92DF-604F-4BE7-AEEF-3B5AF3C6458E.jpg?v=1782404047&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/16D59113-EC54-45B2-8C51-BADD08434453.jpg?v=1782404047&width=900"
    ],
    "price": 2000,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-264264",
    "createdAt": "2026-06-24T16:42:17+02:00",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111422267720",
    "brand": "Gucci",
    "title": "Sherry Line Supreme Clutch Bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/DBC0487F-B28B-4826-8A5B-C3C50951343B.jpg?v=1782405406&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/7DFB7D22-D607-477D-A315-D003C969D83F.jpg?v=1782405406&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E728E0E5-0E76-4021-B34D-20E4DD599609.jpg?v=1782405407&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5E7ED5C9-CE60-4611-944F-722BD202223A.jpg?v=1782405407&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2421C72E-C0D9-4355-973E-49B73C3680E7.jpg?v=1782405406&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/737B3FE8-6DC7-4CB5-9ACC-4DD2D811C1EC.jpg?v=1782405406&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A5B1FBF8-C498-433E-8F17-C6C74C2AC02F.jpg?v=1782405406&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/62BF8A68-5386-4929-AF74-191757CA9EEF.jpg?v=1782405406&width=900"
    ],
    "price": 2500,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-267720",
    "createdAt": "2026-06-24T16:38:06+02:00",
    "description": "Perfect vintage bag - No defects",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111420268872",
    "brand": "Gucci",
    "title": "GG Signature Leather Belt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/3E675221-C636-4EE9-8A6A-265B3C7FDAE0.jpg?v=1782401671&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/223F79A0-67C7-4142-950C-F6E7B9A4B56E.jpg?v=1782401670&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/FE7BCA8C-5FBC-4C0D-8A2A-77642914F912.jpg?v=1782401671&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/05FEC5BC-A079-4024-9A6E-51878EB1BA99.jpg?v=1782401671&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/9FC12A64-DB02-4241-B82C-47C0188D9560.jpg?v=1782401673&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CA022CAE-85AB-4BD3-B7FB-2C57C070CF97.jpg?v=1782401670&width=900"
    ],
    "price": 2200,
    "compareAtPrice": null,
    "size": "95",
    "availableForSale": false,
    "isNew": true,
    "category": "Belts",
    "sku": "CF-268872",
    "createdAt": "2026-06-24T16:37:23+02:00",
    "description": "Size 95 Fits W34-37 Comes with dustbag Beige and Blue details",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111418990920",
    "brand": "Gucci",
    "title": "Supreme Sherry Line clutch bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/342846AA-CBA2-43C0-8B9B-369582D0B4EC.jpg?v=1782405577&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/15EEA735-49F5-4169-9616-8E20251BE62D.jpg?v=1782405577&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/67DE6D60-6C46-4CB3-9C7E-8B24DF8E34DD.jpg?v=1782405577&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/1F8AFD85-DD05-47D8-882E-5AF672476315.jpg?v=1782405577&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/B8A521B0-3F4D-4199-A3DE-2D48428D0B7A.jpg?v=1782405577&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/08B5D217-87B4-47F1-9938-654DD1F9651C.jpg?v=1782405577&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6A898511-ECEE-437E-B95B-76AA916C1039.jpg?v=1782405578&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/52760FB8-A97F-405A-9A28-64A93866B53A.jpg?v=1782405577&width=900"
    ],
    "price": 2100,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-990920",
    "createdAt": "2026-06-24T16:36:17+02:00",
    "description": "Slight signs of wear on the lining inside the bag",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111416140104",
    "brand": "Gucci",
    "title": "GG Supreme Sherry Line clutch bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/72B8495D-B882-47C3-BB11-4FE17D2D4474.jpg?v=1782405536&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F89350EC-D446-4DC3-994E-FB8E39E9F967.jpg?v=1782405536&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/266B8465-4C4A-404C-8971-71E0DDD9EB56.jpg?v=1782405537&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/3C2BC7D7-BEFC-4FF6-8CFD-FAD7FDDEE6CB.jpg?v=1782405537&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/32260B77-45B3-4916-AD48-C138D2D7929B.jpg?v=1782405537&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/7244BF31-4CE0-4CFB-9A77-64B5168B5646.jpg?v=1782405536&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/290DDA6B-1A29-4B1D-90FC-F6C58C57EAC6.jpg?v=1782405536&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5BE9B568-F4CD-4D4B-B5A3-1F3E85B5391C.jpg?v=1782405537&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/32E519AF-1ABF-4753-A0ED-6F2F7A4D33D5.jpg?v=1782405536&width=900"
    ],
    "price": 2100,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-140104",
    "createdAt": "2026-06-24T16:34:12+02:00",
    "description": "The inside is wear",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111407948104",
    "brand": "Gucci",
    "title": "Sherry Line Clutch Bag with Certificate",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/46398791-092F-4BB1-8E82-5B7C2A615E24.jpg?v=1782405373&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/268BF50A-2ECA-434A-932B-4A8A7E6B691C.jpg?v=1782405372&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6B97209D-3503-4D6D-A379-91AE3B8D06DF.jpg?v=1782405373&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/530B8414-3C76-45CD-98BA-244EAD1EA4A0.jpg?v=1782405373&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/BCD2274A-825D-4024-923C-4032B97BA70E.jpg?v=1782405372&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/58FEC01F-5FA7-40E2-95C1-83F3CD14BFB9.jpg?v=1782405372&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/75D87394-67AA-4EC0-81DD-03E430CBF2E4.jpg?v=1782405373&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5CBDC4F8-D885-4C7D-9984-72C39036C319.jpg?v=1782405373&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/931ADA98-807D-42F2-AC12-5507DAABD8D6.jpg?v=1782405373&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/236E6B09-E0DD-493C-8AC0-E52E19399CD4.jpg?v=1782405373&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/FFDA5D89-FF58-4D6C-94CB-928EA545DDC7.jpg?v=1782405373&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/ABD76F09-5E97-4560-BB1A-3BB5CBE1F705.jpg?v=1782405373&width=900"
    ],
    "price": 2000,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": false,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-948104",
    "createdAt": "2026-06-24T16:32:00+02:00",
    "description": "Comes with the certification and a booklet",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111377375560",
    "brand": "Gucci",
    "title": "GG Plus Clutch Bag",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CD825466-74C6-4645-B288-02378FF88321.jpg?v=1782403211&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D8C1B53F-1D72-4554-A152-8696C6F139C0.jpg?v=1782403211&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5EE4943A-4208-45EA-B765-2AE633B29450.jpg?v=1782403212&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/DCD29855-A4C8-42B8-B843-B33899382AAC.jpg?v=1782403210&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E62E5923-AFF1-4DE8-8ED2-857B34293086.jpg?v=1782403211&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/B7C393FC-5DEB-4A35-9353-AE2E97076CC5.jpg?v=1782403212&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2A638785-FF32-4C87-9E31-F93FA491AAD6.jpg?v=1782403215&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/8A856F5D-6B78-4079-83C3-1FBE83073CCE.jpg?v=1782403212&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5FB4D728-564B-4578-B20A-FC993A777801.jpg?v=1782403211&width=900"
    ],
    "price": 1100,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-375560",
    "createdAt": "2026-06-24T16:22:16+02:00",
    "description": "A few stains on the inside of the pouch a small hole near the zip (just needs a bit of stitching)",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10111369281864",
    "brand": "Gucci",
    "title": "Plus Clutch",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EB03B303-90A3-47F6-9103-3B439B2F9942.jpg?v=1782403160&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/87675DE2-063E-4919-92DF-6618A1FA1764.jpg?v=1782403162&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/745BC420-4431-431A-945B-FF76BD34D7BA.jpg?v=1782403161&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/7687DE22-110E-42BA-A699-0CBD65674714.jpg?v=1782403160&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5078E21D-A8E9-45A7-8853-695B624323D5.jpg?v=1782403160&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2D95A407-208C-4D6A-8C64-A043E933D6BE.jpg?v=1782403160&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EB65D094-17B9-46DA-8436-F0F6542494EC.jpg?v=1782403159&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/DB6304C3-40A8-4AD5-858B-4B4EDF25D5CE.jpg?v=1782403161&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/C22B9130-F4AA-42E5-ADC9-A779FAB9984C.jpg?v=1782403160&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/038D3284-0905-4A18-9FB4-24E1DF3FCE12.jpg?v=1782403161&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/7C3F4108-4D53-4F4C-A854-97A599FD1BC6.jpg?v=1782403160&width=900"
    ],
    "price": 1300,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-281864",
    "createdAt": "2026-06-24T16:18:41+02:00",
    "description": "Pocket on the back of the clutch Inside in perfect condition",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10100883652936",
    "brand": "Gucci",
    "title": "GG Plus Pouch",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/63C50740-C653-4FF3-BB1E-5770E9FAEC9E.jpg?v=1781882711&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/248F1EC3-C62C-4BD6-B8CA-CEDE4473C092.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/DCBDF7E1-595E-4F09-BC53-54D9F73FF71D.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/85CFBA6C-BB93-489A-80AC-13CFDC2EAD95.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/23C0A461-50C1-4293-BD35-A275AE7A6FA1.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/35282EFD-6DFB-4D82-85CD-3755E4983D27.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/DDBC9D0A-2AA2-4C24-9DEB-B37B2DD10D82.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/10B73AA6-0CF8-422C-B880-16D0EFA54CC1.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D5C684D6-6731-4CAD-A483-B01490E49677.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/B7B96C12-EC4F-4496-A1A5-E3A213F89826.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6B59BBE7-2D88-4F96-A1A7-FB96B57C8C96.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/5D3602B0-6196-48C1-8D51-360170EBEE74.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A963E310-A399-49B6-AC67-43EB9D06C795.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/79828083-E647-4BEB-8DA4-E583702D468C.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/FFEC5225-E5F6-4CD1-9DD9-59870A0D669C.jpg?v=1781882710&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/39E7EC86-AC47-4823-9E23-446DAB74B747.jpg?v=1781882710&width=900"
    ],
    "price": 990,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": true,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-652936",
    "createdAt": "2026-06-17T17:13:29+02:00",
    "description": "Comes with 2 charms No holes - PVC perfect condition inside and outside Signs of wear on the zipper",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10100881424712",
    "brand": "Moncler",
    "title": "Gien Gilet Vest",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/AE738911-60EF-4664-9444-3AB7C6C6ABC1.jpg?v=1781886741&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/2FB91D44-7D2B-421E-94B6-B1BCD1F510DE.jpg?v=1781886742&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/3FEF8CA0-6C6F-4707-92B9-2E4ED4650A81.jpg?v=1781886741&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/8599B907-951F-48B4-9AFC-8AE1745B5464.jpg?v=1781886741&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/E4A9EB4A-0AA7-487E-A37F-7C037C863212.jpg?v=1781886741&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/84969C01-F967-4803-9480-312690304CCC.jpg?v=1781886741&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/7BAC4672-54C2-4488-9BC7-482742C644C8.jpg?v=1781886741&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/10F34195-DFFB-4FDA-B226-6C8129D0EEE7.jpg?v=1781886741&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/769098DA-31B9-4037-81EA-2813CAEC1575.jpg?v=1781886741&width=900"
    ],
    "price": 3900,
    "compareAtPrice": null,
    "size": "M",
    "availableForSale": true,
    "isNew": true,
    "category": "Outerwear",
    "sku": "CF-424712",
    "createdAt": "2026-06-17T17:10:48+02:00",
    "description": "Size 3 - Excelent condition Vest with hood and three-colour zip",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10105627050312",
    "brand": "Gucci",
    "title": "Sherry Line clutch",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/16B5751C-3272-46C8-AA14-81C52878CE13.jpg?v=1781882359&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A64BC9AD-4BD6-449D-ADC7-854885E0C737.jpg?v=1781882359&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/258E05E4-9825-44C9-81A7-4DF01A6D3731.jpg?v=1781882359&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/A8EFED4B-5258-4D24-B444-1F510E9F2D28.jpg?v=1781882358&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/C05D4CD7-ADDF-4ECE-9130-63DB4F1AFE61.jpg?v=1781882359&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CB451BEF-4F3F-4B9E-8630-F9B30CE7DE46.jpg?v=1781882359&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/C120F0D9-59D0-4F2D-B93F-EC558F886B99.jpg?v=1781882359&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/4B6071FB-20E3-4634-A732-9F47B4339191.jpg?v=1781882358&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F933C236-5A63-493B-8646-1471B7BBE3A1.jpg?v=1781882358&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/4CCF5E16-9DEC-44A9-9C92-7262A98DAA86.jpg?v=1781882359&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/9C8014DC-C885-4F26-805F-6396D6D0E376.jpg?v=1781882358&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/8E9CD737-8CA8-4623-9B07-48DD0159730A.jpg?v=1781882358&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/08EAA367-A0CD-49A1-8A2D-398FFEC9645F.jpg?v=1781882360&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/42635D16-1F5D-4792-9E66-0EB1B7E1D2AB.jpg?v=1781882359&width=900"
    ],
    "price": 1500,
    "compareAtPrice": null,
    "size": null,
    "availableForSale": false,
    "isNew": true,
    "category": "Bags",
    "sku": "CF-050312",
    "createdAt": "2026-06-19T17:19:00+02:00",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10105613844808",
    "brand": "Moncler",
    "title": "Tricolor Polo",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/93D2E162-6A1A-49E8-925E-9759CAE91190.jpg?v=1781885297&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/101109F2-F633-4030-9BC6-8F635722F8BA.jpg?v=1781885297&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/4C03A3C2-92EB-4742-A38F-1EDFD62C6321.jpg?v=1781885297&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/8B09F434-EF77-409E-AF88-84C08B23EE57.jpg?v=1781885297&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/3FEA806B-8A9A-4912-9DEA-1E715753412A.jpg?v=1781885297&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/0FB98EDA-F6C6-471D-B5CB-5D024686FC0B.jpg?v=1781885297&width=900"
    ],
    "price": 1100,
    "compareAtPrice": null,
    "size": "M",
    "availableForSale": false,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-844808",
    "createdAt": "2026-06-19T16:37:01+02:00",
    "description": "Details on the bottom with the 3 colors too",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10105603653960",
    "brand": "Balmain",
    "title": "Grey T-Shirt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/77A2019A-27C7-4F13-BE11-D56F14D592B4.jpg?v=1781885363&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/6640678D-B604-4314-AE1F-AC240029D05C.jpg?v=1781885363&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D4204675-1222-4DFF-BACC-4E27E5D9A503.jpg?v=1781885364&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D33CDC23-AD48-4F46-92C6-EB270A597206.jpg?v=1781885363&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/F3E7A7F6-8D3E-4F39-ADE1-39D622FDE3FD.jpg?v=1781885363&width=900"
    ],
    "price": 1100,
    "compareAtPrice": null,
    "size": "L",
    "availableForSale": false,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-653960",
    "createdAt": "2026-06-19T16:06:27+02:00",
    "description": "Double logo T-shirt Balmain Paris",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10105601425736",
    "brand": "Moncler",
    "title": "1952 T-Shirt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/8CED55D9-33B9-4220-86BC-D703C8EAB3A6.jpg?v=1781885421&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/188B4D88-091F-4D36-B209-0F573DCB9B15.jpg?v=1781885422&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/DA1FD57B-94FE-453F-A625-CEB9FEFD38C6.jpg?v=1781885422&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CD1A6DD7-7EB3-40CE-87DA-A00204C674FA.jpg?v=1781885421&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/EE61880F-2475-4E94-9EC3-292105BA1BF5.jpg?v=1781885422&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/9FDE6E52-95C7-4ED0-9366-CF1591B8E7DF.jpg?v=1781885422&width=900"
    ],
    "price": 900,
    "compareAtPrice": null,
    "size": "XL",
    "availableForSale": false,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-425736",
    "createdAt": "2026-06-19T15:58:45+02:00",
    "description": "The logo is a bit faded, but that’s normal, it’s part of the T-shirt’s vintage look.",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  },
  {
    "id": "cf-10105593725256",
    "brand": "Moncler",
    "title": "Tricolor Logo T-Shirt",
    "images": [
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/7784414B-8F3E-4FEC-BEFE-83EE41F7CF35.jpg?v=1781885443&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/16A79701-47C3-49FF-9058-85715BD9D1C0.jpg?v=1781885443&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/CE20B7DA-C6EF-4502-99C7-8CDD40D18C27.jpg?v=1781885444&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/D7676F6F-044C-41C9-810F-C90553A161A2.jpg?v=1781885446&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/BD6F5729-EC75-43DC-8280-09CA5FCD65F6.jpg?v=1781885444&width=900",
      "https://cdn.shopify.com/s/files/1/0773/2730/2984/files/27E1808A-9246-4248-AA0F-17ABEC5460D7.jpg?v=1781885444&width=900"
    ],
    "price": 900,
    "compareAtPrice": null,
    "size": "S",
    "availableForSale": true,
    "isNew": true,
    "category": "Tops",
    "sku": "CF-725256",
    "createdAt": "2026-06-19T15:42:56+02:00",
    "description": "Logo in the center of the t-shirt is in perfect condition. Good vintage Moncler T-shirt",
    "authenticity": {
      "verified": true,
      "verifiedBy": "Verified in-house by Circular Fash"
    }
  }
];
