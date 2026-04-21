package main

import "testing"

func TestUniqueLower(t *testing.T) {
	got := uniqueLower([]string{" ID_Document ", "transcript", "id_document", ""})
	if len(got) != 2 {
		t.Fatalf("expected 2 unique documents, got %d", len(got))
	}
	if got[0] != "id_document" || got[1] != "transcript" {
		t.Fatalf("unexpected normalized values: %#v", got)
	}
}

func TestNormalizeSchoolID(t *testing.T) {
	if got := normalizeSchoolID(" Alpha High "); got != "alpha-high" {
		t.Fatalf("expected alpha-high, got %s", got)
	}
}
