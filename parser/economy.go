package parser

import (
	common "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
)

// snapshotTeamEconomy captures economy data for one team at freeze time end.
// If the team-level convenience methods return zero (common in CS2 Source 2
// demos), it falls back to summing per-player values from entity properties.
func snapshotTeamEconomy(team *common.TeamState, roundNum int) EconomySnapshot {
	if team == nil {
		return EconomySnapshot{}
	}

	equipValue := team.FreezeTimeEndEquipmentValue()
	spent := team.MoneySpentThisRound()

	// CS2 fallback: team-level methods often return 0 because the freeze
	// time end snapshot properties are not populated. Sum per-player values
	// from entity properties instead.
	if equipValue == 0 {
		equipValue = sumEquipmentValue(team)
	}
	if spent == 0 {
		spent = sumMoneySpent(team)
	}

	bt := ClassifyBuyType(equipValue)
	if isPistolRound(roundNum) {
		bt = BuyTypePistol
	}

	return EconomySnapshot{
		TeamSpend:      spent,
		EquipmentValue: equipValue,
		BuyType:        bt,
	}
}

// sumEquipmentValue sums EquipmentValueCurrent across all team members.
// This reads m_unCurrentEquipmentValue from each player's pawn entity,
// which is reliably populated in CS2 demos at freeze time end.
func sumEquipmentValue(team *common.TeamState) int {
	total := 0
	for _, pl := range team.Members() {
		if pl == nil {
			continue
		}
		total += pl.EquipmentValueCurrent()
	}
	return total
}

// sumMoneySpent sums MoneySpentThisRound across all team members.
// This reads m_pInGameMoneyServices.m_iCashSpentThisRound from each
// player's controller entity.
func sumMoneySpent(team *common.TeamState) int {
	total := 0
	for _, pl := range team.Members() {
		if pl == nil {
			continue
		}
		total += pl.MoneySpentThisRound()
	}
	return total
}
