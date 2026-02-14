.PHONY: proto-gen build dev test clean

proto-gen:
	buf generate proto/

build: proto-gen
	cd frontend && npm ci && npm run build
	go build -o bin/cs2stats ./cmd/server/

dev:
	go run ./cmd/server/

test:
	go test ./...

clean:
	rm -rf bin/
	rm -rf frontend/dist/
	rm -rf transport/grpc/gen/
	rm -rf frontend/src/gen/
