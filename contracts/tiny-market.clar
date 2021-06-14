;; tiny-market
;; A tiny NFT marketplace that allows users to list NFT for sale. They can specify the following:
;; - The NFT token to sell.
;; - Listing expiry in block height.
;; - The payment asset, either STX or a SIP010 fungible token.
;; - The NFT price in said payment asset.
;; - An optional intended taker. If set, only that principal will be able to fulfill the listing.

(use-trait nft-trait .sip009-nft-trait.nft-trait)
(use-trait ft-trait .sip010-ft-trait.ft-trait)

;; listing errors
(define-constant err-expiry-in-past (err u1000))
(define-constant err-price-zero (err u1001))
(define-constant err-storage-failure (err u1002))

;; cancelling and fulfilling errors
(define-constant err-unknown-listing (err u2000))
(define-constant err-unauthorised (err u2001))
(define-constant err-listing-expired (err u2002))
(define-constant err-nft-asset-mismatch (err u2003))
(define-constant err-payment-asset-mismatch (err u2004))
(define-constant err-maker-taker-equal (err u2005))
(define-constant err-unintended-taker (err u2006))

(define-map listings
	{id: uint}
	{
		maker: principal,
		taker: (optional principal),
		token-id: uint,
		nft-asset-contract: principal,
		expiry: uint,
		price: uint,
		payment-asset-contract: (optional principal)
	}
)

(define-data-var listing-nonce uint u0)

(define-private (transfer-nft (token-contract <nft-trait>) (token-id uint) (sender principal) (recipient principal))
	(contract-call? token-contract transfer token-id sender recipient)
)

(define-private (transfer-ft (token-contract <ft-trait>) (amount uint) (sender principal) (recipient principal))
	(contract-call? token-contract transfer amount sender recipient)
)

(define-public (list-asset (nft-asset-contract <nft-trait>) (nft-asset {taker: (optional principal), token-id: uint, expiry: uint, price: uint, payment-asset-contract: (optional principal)}))
	(let ((listing-id (var-get listing-nonce)))
		(asserts! (> (get expiry nft-asset) block-height) err-expiry-in-past)
		(asserts! (> (get price nft-asset) u0) err-price-zero)
		(try! (transfer-nft nft-asset-contract (get token-id nft-asset) tx-sender (as-contract tx-sender)))
		(asserts! (map-set listings {id: listing-id} (merge {maker: tx-sender, nft-asset-contract: (contract-of nft-asset-contract)} nft-asset)) err-storage-failure)
		(asserts! (var-set listing-nonce (+ listing-id u1)) err-storage-failure)
		(ok listing-id)
	)
)

(define-read-only (get-listing (listing-id uint))
	(map-get? listings {id: listing-id})
)

(define-public (cancel-listing (listing-id uint) (nft-asset-contract <nft-trait>))
	(let (
		(listing (unwrap! (map-get? listings {id: listing-id}) err-unknown-listing))
		(maker (get maker listing))
		)
		(asserts! (is-eq maker tx-sender) err-unauthorised)
		(map-delete listings {id: listing-id})
		(as-contract (transfer-nft nft-asset-contract (get token-id listing) tx-sender maker))
	)
)

(define-private (assert-can-fulfill (nft-asset-contract principal) (payment-asset-contract (optional principal)) (listing {maker: principal, taker: (optional principal), token-id: uint, nft-asset-contract: principal, expiry: uint, price: uint, payment-asset-contract: (optional principal)}))
	(begin
		(asserts! (not (is-eq (get maker listing) tx-sender)) err-maker-taker-equal)
		(asserts! (match (get taker listing) intended-taker (is-eq intended-taker tx-sender) true) err-unintended-taker)
		(asserts! (< block-height (get expiry listing)) err-listing-expired)
		(asserts! (is-eq (get nft-asset-contract listing) nft-asset-contract) err-nft-asset-mismatch)
		(asserts! (is-eq (get payment-asset-contract listing) payment-asset-contract) err-payment-asset-mismatch)
		(ok true)
	)
)

(define-public (fulfill-listing-stx (listing-id uint) (nft-asset-contract <nft-trait>))
	(let (
		(listing (unwrap! (map-get? listings {id: listing-id}) err-unknown-listing))
		(taker tx-sender)
		)
		(try! (assert-can-fulfill (contract-of nft-asset-contract) none listing))
		(try! (as-contract (transfer-nft nft-asset-contract (get token-id listing) tx-sender taker)))
		(try! (stx-transfer? (get price listing) taker (get maker listing)))
		(map-delete listings {id: listing-id})
		(ok listing-id)
	)
)

(define-public (fulfill-listing-ft (listing-id uint) (nft-asset-contract <nft-trait>) (payment-asset-contract <ft-trait>))
	(let (
		(listing (unwrap! (map-get? listings {id: listing-id}) err-unknown-listing))
		(taker tx-sender)
		)
		(try! (assert-can-fulfill (contract-of nft-asset-contract) (some (contract-of payment-asset-contract)) listing))
		(try! (as-contract (transfer-nft nft-asset-contract (get token-id listing) tx-sender taker)))
		(try! (transfer-ft payment-asset-contract (get price listing) taker (get maker listing)))
		(map-delete listings {id: listing-id})
		(ok listing-id)
	)
)
