;; timelocked-wallet-simplified
;; A simplified version of the timelocked-wallet contract that uses top-level defines.

(define-constant err-beneficiary-only (err u100))
(define-constant err-unlock-height-not-reached (err u101))
(define-constant unlock-height u25000)

(define-data-var beneficiary principal 'SP000000000000000000002Q6VF78)

(define-public (bestow (new-beneficiary principal))
	(begin
		(asserts! (is-eq tx-sender (var-get beneficiary)) err-beneficiary-only)
		(ok (var-set beneficiary new-beneficiary))
	)
)

(define-public (claim)
	(begin
		(asserts! (is-eq tx-sender (var-get beneficiary)) err-beneficiary-only)
		(asserts! (>= block-height unlock-height) err-unlock-height-not-reached)
		(as-contract (stx-transfer? (stx-get-balance tx-sender) tx-sender (var-get beneficiary)))
	)
)
