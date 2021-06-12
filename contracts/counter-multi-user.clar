;; counter-multi-user
;; A multiuser version of the counter contract.

(define-map counters {who: principal} {count: uint})

(define-read-only (get-count)
	(get count (map-get? counters {who: tx-sender}))
)

(define-public (count-up)
	(let ((new-count (+ (default-to u0 (get-count)) u1)))
		(map-set counters {who: tx-sender} {count: new-count})
		(ok new-count)
	)
)
