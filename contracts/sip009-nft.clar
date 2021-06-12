;; sip009-nft
;; A SIP009-compliant NFT with a mint function.

(impl-trait .sip009-nft-trait.nft-trait)

(define-constant contract-owner tx-sender)

(define-constant err-owner-only (err u100))
(define-constant err-token-id-failure (err u101))
(define-constant err-not-token-owner (err u102))

(define-non-fungible-token stacksies uint)
(define-data-var token-id-nonce uint u0)

;; "Takes no arguments and returns the identifier for the last NFT registered using the contract."
;; What if no NFTs were ever minted?
(define-read-only (get-last-token-id)
	(ok (var-get token-id-nonce))
)

(define-read-only (get-token-uri (token-id uint))
	(begin
		(unwrap! (nft-get-owner? stacksies token-id) (ok none))
		(ok (some "https://stacksies.com/metadata/"))
		;; (ok (some (concat (concat "https://stacksies.com/metadata/" (to-ascii token-id)) ".json")))
	)
)

(define-read-only (get-owner (token-id uint))
	(ok (nft-get-owner? stacksies token-id))
)

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
	(begin
		(asserts! (is-eq tx-sender sender) err-not-token-owner)
		(nft-transfer? stacksies token-id sender recipient)
	)
)

(define-public (mint (recipient principal))
	(let ((token-id (+ (var-get token-id-nonce) u1)))
		(asserts! (is-eq tx-sender contract-owner) err-owner-only)
		(try! (nft-mint? stacksies token-id recipient))
		(asserts! (var-set token-id-nonce token-id) err-token-id-failure)
		(ok token-id)
	)
)
