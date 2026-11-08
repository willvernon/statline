-- grain: one row per player per season per season_type
-- counts and yards: sum. longs: max. rates and percentages: recomputed from totals (0-1 scale).
select
    -- keys / context (player_id maps to gsis_id on dim_player in marts)
    player_id,
    -- latest position that season, so a mid-season change doesn't split the row
    arg_max(position, week) as position,
    arg_max(position_group, week) as position_group,
    season,
    count(distinct game_id) as gp,
    season_type,
    -- passing
    sum(completions) / nullif(sum(attempts), 0) as comp_pct,
    sum(completions) as completions,
    sum(attempts) as attempts,
    sum(passing_yards) / nullif(sum(attempts), 0) as py_att,
    sum(passing_yards) / nullif(count(distinct game_id), 0) as py_gp,
    sum(passing_yards) as passing_yards,
    sum(passing_tds) as passing_tds,
    sum(passing_yards) / nullif(sum(passing_interceptions), 0) as py_per_int,
    sum(passing_interceptions) as passing_interceptions,
    sum(sacks_suffered) as sacks_suffered,
    sum(sack_yards_lost) as sack_yards_lost,
    sum(sack_fumbles) as sack_fumbles,
    sum(sack_fumbles_lost) as sack_fumbles_lost,
    sum(passing_air_yards) as passing_air_yards,
    sum(passing_yards_after_catch) as passing_yards_after_catch,
    sum(passing_first_downs) as passing_first_downs,
    sum(passing_epa) as passing_epa,
    -- cpoe is a per-attempt rate: weight each game by its attempts
    sum(passing_cpoe * attempts) / nullif(sum(attempts), 0) as passing_cpoe,
    sum(passing_2pt_conversions) as passing_2pt_conversions,
    -- pacr = passing yards / passing air yards
    sum(passing_yards) / nullif(sum(passing_air_yards), 0) as pacr,
    sum(passing_10) as passing_10,
    sum(passing_16) as passing_16,
    sum(passing_20) as passing_20,
    sum(passing_40) as passing_40,
    -- rushing
    sum(rushing_yards) / nullif(sum(carries), 0) as rush_ypc,
    sum(carries) as carries,
    sum(rushing_yards) as rushing_yards,
    sum(rushing_tds) as rushing_tds,
    sum(rushing_fumbles) as rushing_fumbles,
    sum(rushing_fumbles_lost) as rushing_fumbles_lost,
    sum(rushing_first_downs) as rushing_first_downs,
    sum(rushing_epa) as rushing_epa,
    sum(rushing_2pt_conversions) as rushing_2pt_conversions,
    sum(rushing_10) as rushing_10,
    sum(rushing_12) as rushing_12,
    sum(rushing_20) as rushing_20,
    sum(rushing_40) as rushing_40,
    -- receiving
    sum(receptions) as receptions,
    sum(receiving_yards) / nullif(sum(receptions), 0) as yd_rec,
    sum(receiving_yards) / nullif(sum(targets), 0) as yd_tgt,
    sum(targets) as targets,
    sum(receiving_yards) as receiving_yards,
    sum(receiving_tds) as receiving_tds,
    sum(receiving_fumbles) as receiving_fumbles,
    sum(receiving_fumbles_lost) as receiving_fumbles_lost,
    sum(receiving_air_yards) as receiving_air_yards,
    sum(receiving_yards_after_catch) as receiving_yards_after_catch,
    sum(receiving_yards_after_catch) / nullif(sum(receptions), 0) as yac_rec,
    sum(receiving_first_downs) as receiving_first_downs,
    sum(receiving_epa) as receiving_epa,
    sum(receiving_2pt_conversions) as receiving_2pt_conversions,
    sum(receiving_10) as receiving_10,
    sum(receiving_16) as receiving_16,
    sum(receiving_20) as receiving_20,
    sum(receiving_40) as receiving_40,
    -- racr = receiving yards / receiving air yards
    sum(receiving_yards) / nullif(sum(receiving_air_yards), 0) as racr,
    -- target_share, air_yards_share, wopr: left out. They need team totals,
    -- so compute them downstream from this model + agg_team_season.
    -- special teams TDs
    sum(special_teams_tds) as special_teams_tds,
    -- defense
    sum(def_tackles_solo) as def_tackles_solo,
    sum(def_tackles_with_assist) as def_tackles_with_assist,
    sum(def_tackle_assists) as def_tackle_assists,
    sum(def_tackles_for_loss) as def_tackles_for_loss,
    sum(def_tackles_for_loss_yards) as def_tackles_for_loss_yards,
    sum(def_fumbles_forced) as def_fumbles_forced,
    sum(def_sacks) as def_sacks,
    sum(def_sack_yards) as def_sack_yards,
    sum(def_qb_hits) as def_qb_hits,
    sum(def_interceptions) as def_interceptions,
    sum(def_interception_yards) as def_interception_yards,
    sum(def_pass_defended) as def_pass_defended,
    sum(def_tds) as def_tds,
    sum(def_fumbles) as def_fumbles,
    sum(def_safeties) as def_safeties,
    -- fumbles / misc / penalties
    sum(misc_yards) as misc_yards,
    sum(fumble_recovery_own) as fumble_recovery_own,
    sum(fumble_recovery_yards_own) as fumble_recovery_yards_own,
    sum(fumble_recovery_opp) as fumble_recovery_opp,
    sum(fumble_recovery_yards_opp) as fumble_recovery_yards_opp,
    sum(fumble_recovery_tds) as fumble_recovery_tds,
    sum(penalties) as penalties,
    sum(penalty_yards) as penalty_yards,
    sum(fumbles_forced_by_opp) as fumbles_forced_by_opp,
    sum(fumbles_not_forced) as fumbles_not_forced,
    sum(fumbles_out_of_bounds) as fumbles_out_of_bounds,
    sum(fumbles_total) as fumbles_total,
    sum(fumbles_lost_total) as fumbles_lost_total,
    -- returns
    sum(punt_returns) as punt_returns,
    sum(punt_return_yards) as punt_return_yards,
    sum(kickoff_returns) as kickoff_returns,
    sum(kickoff_return_yards) as kickoff_return_yards,
    -- field goals
    sum(fg_made) as fg_made,
    sum(fg_att) as fg_att,
    sum(fg_missed) as fg_missed,
    sum(fg_blocked) as fg_blocked,
    max(fg_long) as fg_long,
    sum(fg_made) / nullif(sum(fg_att), 0) as fg_pct,
    sum(fg_made_0_19) as fg_made_0_19,
    sum(fg_made_20_29) as fg_made_20_29,
    sum(fg_made_30_39) as fg_made_30_39,
    sum(fg_made_40_49) as fg_made_40_49,
    sum(fg_made_50_59) as fg_made_50_59,
    sum(fg_made_60_) as fg_made_60_,
    sum(fg_missed_0_19) as fg_missed_0_19,
    sum(fg_missed_20_29) as fg_missed_20_29,
    sum(fg_missed_30_39) as fg_missed_30_39,
    sum(fg_missed_40_49) as fg_missed_40_49,
    sum(fg_missed_50_59) as fg_missed_50_59,
    sum(fg_missed_60_) as fg_missed_60_,
    -- per-game '22;33;48' text -> one season list of distances, in week order
    flatten(
        list(
            string_split(fg_made_list, ';')::integer[]
            order by
                week
        ) filter(
            where
                fg_made_list is not null
        )
    ) as fg_made_list,
    flatten(
        list(
            string_split(fg_missed_list, ';')::integer[]
            order by
                week
        ) filter(
            where
                fg_missed_list is not null
        )
    ) as fg_missed_list,
    flatten(
        list(
            string_split(fg_blocked_list, ';')::integer[]
            order by
                week
        ) filter(
            where
                fg_blocked_list is not null
        )
    ) as fg_blocked_list,
    sum(fg_made_distance) as fg_made_distance,
    sum(fg_missed_distance) as fg_missed_distance,
    sum(fg_blocked_distance) as fg_blocked_distance,
    -- PAT / game-winning FG
    sum(pat_made) as pat_made,
    sum(pat_att) as pat_att,
    sum(pat_missed) as pat_missed,
    sum(pat_blocked) as pat_blocked,
    sum(pat_made) / nullif(sum(pat_att), 0) as pat_pct,
    sum(gwfg_made) as gwfg_made,
    sum(gwfg_att) as gwfg_att,
    sum(gwfg_missed) as gwfg_missed,
    sum(gwfg_blocked) as gwfg_blocked,
    -- 0 means no game-winning attempt that game
    list(
        gwfg_distance
        order by
            week
    ) filter(
        where
            gwfg_distance > 0
    ) as gwfg_distances,
    -- punting
    sum(pt_att) as pt_att,
    sum(pt_blocked) as pt_blocked,
    max(pt_long) as pt_long,
    sum(pt_yards) as pt_yards,
    sum(pt_inside_20) as pt_inside_20,
    sum(pt_out_of_bounds) as pt_out_of_bounds,
    sum(pt_downed) as pt_downed,
    sum(pt_touchback) as pt_touchback,
    sum(pt_fair_caught) as pt_fair_caught,
    sum(pt_returned) as pt_returned,
    sum(pt_return_yards) as pt_return_yards,
    sum(pt_return_tds) as pt_return_tds,
    sum(pt_net_yards) as pt_net_yards,
    -- fantasy
    sum(fantasy_points) as fantasy_points,
    sum(fantasy_points_ppr) as fantasy_points_ppr
from
    {{ref ('fact_player_game')}}
group by
    season,
    player_id,
    season_type
