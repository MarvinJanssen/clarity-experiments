;; bogus-ft
;; Until we have mocking capabilities.

(impl-trait .sip010-ft-trait.ft-trait)

(define-fungible-token bogus-ft u100000000)

(define-public (transfer (amount uint) (sender principal) (recipient principal))
	(err u1)
)

(define-read-only (get-name)
	(ok "bogus")
)

(define-read-only (get-symbol)
	(ok "BG")
)

(define-read-only (get-decimals)
	(ok u0)
)

(define-read-only (get-balance (who principal))
	(ok u1)
)

(define-read-only (get-total-supply)
	(ok u0)
)

(define-read-only (get-token-uri)
	(ok none)
)
