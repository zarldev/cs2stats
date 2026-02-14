package parser

import (
	common "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
)

// snapshotTeamEconomy captures economy data for one team at freeze time end.
func snapshotTeamEconomy(team *common.TeamState) EconomySnapshot {
	if team == nil {
		return EconomySnapshot{}
	}

	equipValue := team.FreezeTimeEndEquipmentValue()
	spent := team.MoneySpentThisRound()

	return EconomySnapshot{
		TeamSpend:      spent,
		EquipmentValue: equipValue,
		BuyType:        ClassifyBuyType(equipValue),
	}
}
