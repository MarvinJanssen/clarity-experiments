;; counter
;; A basic counter contract.

(define-constant contract-owner tx-sender)

(define-constant err-owner-only (err u100))

(define-data-var counter uint u0)

(define-read-only (get-count)
	(var-get counter)
)

(define-public (count-up)
	(begin
		(asserts! (is-eq contract-owner tx-sender) err-owner-only)
		(var-set counter (+ (get-count) u1))
		(ok (get-count))
	)
)
