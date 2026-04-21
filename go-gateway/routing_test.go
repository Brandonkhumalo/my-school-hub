package main

import "testing"

func TestSelectRouteTarget(t *testing.T) {
	tests := []struct {
		name string
		path string
		want routeTarget
	}{
		{name: "bulk routes to workers", path: "/api/v1/bulk/students", want: targetWorkers},
		{name: "paynow routes to services", path: "/api/v1/finances/payments/paynow/initiate/", want: targetServices},
		{name: "services namespace routes to services", path: "/api/v1/services/email/send", want: targetServices},
		{name: "admissions public routes to admissions go service", path: "/api/v1/admissions/schools/demo-school/applications", want: targetAdmissions},
		{name: "admissions admin routes to admissions django ops", path: "/api/v1/admissions/admin/templates/", want: targetAdmissionsOps},
		{name: "report card routes to django", path: "/api/v1/academics/students/12/report-card/", want: targetDjango},
		{name: "default routes to django", path: "/api/v1/academics/students/", want: targetDjango},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := selectRouteTarget(tt.path); got != tt.want {
				t.Fatalf("selectRouteTarget(%q)=%q want %q", tt.path, got, tt.want)
			}
		})
	}
}
