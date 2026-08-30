CREATE UNIQUE INDEX stream_items_one_pinned ON stream_items ((1)) WHERE state = 'pinned';
CREATE UNIQUE INDEX stream_items_one_auction_open ON stream_items ((1)) WHERE state = 'auction_open';
