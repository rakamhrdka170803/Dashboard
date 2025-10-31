package service

import (
	"errors"
	"time"

	"bjb-backoffice/internal/domain"
	"bjb-backoffice/internal/repository"
)

type CWCService struct{ repo repository.CWCRepository }

func NewCWCService(repo repository.CWCRepository) *CWCService { return &CWCService{repo: repo} }

const (
	CatComplaint = "COMPLAINT"
	CatRequest   = "REQUEST"
	CatInfo      = "INFO"
)

// Urutan HARUS sama seperti brief user (dipakai buat mapping textarea → subkey)
var ComplaintOrder = []string{
	"Saldo Terdebet",
	"Pelayanan Cabang",
	"Penipuan",
	"Gangguan System",
	"Kartu ATM Tertelan di ATM BJB kesalahan nasabah",
	"Kartu ATM Tertelan di ATM BJB kesalahan sistem",
	"Kartu ATM Tertelan di ATM Lain kesalahan nasabah",
	"Kartu ATM Tertelan di ATM Lain kesalahan sistem",
	"Kesulitan menghubungi cabang",
}

var RequestOrder = []string{
	"Blokir Kartu ATM",
	"Aktivasi Kartu",
	"Rst BJB Net kegagalan System",
	"Rst BJB Net kesalahan nasabah",
	"Rst BJB SMS kegagalan System",
	"Rst BJB SMS kesalahan nasabah",
	"Reset Bjb Mobile karena kesalahan sistem",
	"Reset Bjb Mobile karena kesalahan nasabah",
	"Reset SMB",
	"Blokir SMB",
	"Reset Digi cash",
	"Block Digi Cash",
	"UnBlock Digi Cash",
}

var InfoOrder = []string{
	"Lain-lain",
	"Giro",
	"Blokir PPATK",
	"Rekruitment SDM",
	"Jaringan Kantor BJB",
	"DPLK",
	"bjb precious",
	"Tabungan",
	"Status Rekening",
	"Deposito",
	"kartu kredit bjb",
	"Kredit",
	"atm",
	"BJB Net",
	"BJB SMS",
	"IBC dan  CMS",
	"BJB Mobile",
	"Digi Cash",
	"SMB",
	"Gagal Update IOS",
	"Kiriman Uang",
	"Jasa Lainnya",
	"Customer Consent",
	"Pajak",
	"Call Terputus",
}

type UpsertDailyInput struct {
	Date      time.Time
	Complaint []int
	Request   []int
	Info      []int
}

func (s *CWCService) CategoriesDef() map[string][]string {
	return map[string][]string{
		CatComplaint: ComplaintOrder,
		CatRequest:   RequestOrder,
		CatInfo:      InfoOrder,
	}
}

func (s *CWCService) UpsertDaily(in UpsertDailyInput) error {
	// validasi panjang sesuai urutan
	if len(in.Complaint) != len(ComplaintOrder) {
		return errors.New("len complaint tidak sesuai definisi")
	}
	if len(in.Request) != len(RequestOrder) {
		return errors.New("len request tidak sesuai definisi")
	}
	if len(in.Info) != len(InfoOrder) {
		return errors.New("len info tidak sesuai definisi")
	}

	var batch []domain.CWCEntry
	for i, sub := range ComplaintOrder {
		batch = append(batch, domain.CWCEntry{Category: CatComplaint, SubKey: sub, Count: in.Complaint[i]})
	}
	for i, sub := range RequestOrder {
		batch = append(batch, domain.CWCEntry{Category: CatRequest, SubKey: sub, Count: in.Request[i]})
	}
	for i, sub := range InfoOrder {
		batch = append(batch, domain.CWCEntry{Category: CatInfo, SubKey: sub, Count: in.Info[i]})
	}

	return s.repo.UpsertBatch(in.Date, batch)
}

type CWCRow struct {
	Date     time.Time `json:"date"`
	Category string    `json:"category"`
	SubKey   string    `json:"sub_key"`
	Count    int       `json:"count"`
}

type QueryRangeOutput struct {
	Items      []CWCRow                  `json:"items"`
	Totals     map[string]map[string]int `json:"totals_by_category"` // category -> subkey -> sum
	ByDate     map[string]map[string]int `json:"by_date"`            // "YYYY-MM-DD" -> category|subkey -> count
	Categories map[string][]string       `json:"categories"`         // definisi urutan
}

func (s *CWCService) QueryRange(start, end time.Time) (*QueryRangeOutput, error) {
	rows, err := s.repo.QueryRange(start, end)
	if err != nil {
		return nil, err
	}
	out := &QueryRangeOutput{
		Items:      make([]CWCRow, 0, len(rows)),
		Totals:     map[string]map[string]int{},
		ByDate:     map[string]map[string]int{},
		Categories: s.CategoriesDef(),
	}
	for _, r := range rows {
		out.Items = append(out.Items, CWCRow{
			Date: r.Date, Category: r.Category, SubKey: r.SubKey, Count: r.Count,
		})
		if _, ok := out.Totals[r.Category]; !ok {
			out.Totals[r.Category] = map[string]int{}
		}
		out.Totals[r.Category][r.SubKey] += r.Count

		key := r.Date.Format("2006-01-02")
		if _, ok := out.ByDate[key]; !ok {
			out.ByDate[key] = map[string]int{}
		}
		out.ByDate[key][r.Category+"|"+r.SubKey] = r.Count
	}
	return out, nil
}

func (s *CWCService) GetDaily(date time.Time) (map[string][]int, error) {
	rows, err := s.repo.GetByDate(date)
	if err != nil {
		return nil, err
	}
	out := map[string][]int{
		CatComplaint: make([]int, len(ComplaintOrder)),
		CatRequest:   make([]int, len(RequestOrder)),
		CatInfo:      make([]int, len(InfoOrder)),
	}
	// helper subkey -> index
	idx := func(list []string) map[string]int {
		m := map[string]int{}
		for i, k := range list {
			m[k] = i
		}
		return m
	}
	ci := idx(ComplaintOrder)
	ri := idx(RequestOrder)
	ii := idx(InfoOrder)

	for _, r := range rows {
		switch r.Category {
		case CatComplaint:
			if p, ok := ci[r.SubKey]; ok {
				out[CatComplaint][p] = r.Count
			}
		case CatRequest:
			if p, ok := ri[r.SubKey]; ok {
				out[CatRequest][p] = r.Count
			}
		case CatInfo:
			if p, ok := ii[r.SubKey]; ok {
				out[CatInfo][p] = r.Count
			}
		}
	}
	return out, nil
}

func (s *CWCService) DeleteDaily(date time.Time) error {
	return s.repo.DeleteByDate(date)
}
