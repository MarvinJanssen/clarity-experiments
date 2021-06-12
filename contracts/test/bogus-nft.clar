;; bogus-nft
;; Until we have mocking capabilities.

(impl-trait .sip009-nft-trait.nft-trait)

(define-non-fungible-token bogus-nft uint)


(define-read-only (get-last-token-id)
	(ok u0)
)

(define-read-only (get-token-uri (token-id uint))
	(ok none)
)

(define-read-only (get-owner (token-id uint))
	(ok none)
)

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
	(err u1)
)
