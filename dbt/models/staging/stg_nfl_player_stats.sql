-- Grain: 1 row per player per week (box score).
-- Silver: full source columns + renames + key filters.
-- Star-schema column cuts belong in gold (marts).

with source as (
    select * from {{ source('raw', 'nfl_player_stats') }}
),

cleaned as (
    select
        -- keys / context (player_id maps to gsis_id on dim_player in marts)
        player_id,
        player_name,
        player_display_name,
        position,
        position_group,
        headshot_url,
        season,
        week,
        season_type,
        game_id,
        team as team_abbr,
        opponent_team as opponent_team_abbr,

        -- passing
        completions,
        attempts,
        passing_yards,
        passing_tds,
        passing_interceptions,
        sacks_suffered,
        sack_yards_lost,
        sack_fumbles,
        sack_fumbles_lost,
        passing_air_yards,
        passing_yards_after_catch,
        passing_first_downs,
        passing_epa,
        passing_cpoe,
        passing_2pt_conversions,
        pacr,
        passing_10,
        passing_16,
        passing_20,
        passing_40,

        -- rushing
        carries,
        rushing_yards,
        rushing_tds,
        rushing_fumbles,
        rushing_fumbles_lost,
        rushing_first_downs,
        rushing_epa,
        rushing_2pt_conversions,
        rushing_10,
        rushing_12,
        rushing_20,
        rushing_40,

        -- receiving
        receptions,
        targets,
        receiving_yards,
        receiving_tds,
        receiving_fumbles,
        receiving_fumbles_lost,
        receiving_air_yards,
        receiving_yards_after_catch,
        receiving_first_downs,
        receiving_epa,
        receiving_2pt_conversions,
        receiving_10,
        receiving_16,
        receiving_20,
        receiving_40,
        racr,
        target_share,
        air_yards_share,
        wopr,

        -- special teams TDs
        special_teams_tds,

        -- defense
        def_tackles_solo,
        def_tackles_with_assist,
        def_tackle_assists,
        def_tackles_for_loss,
        def_tackles_for_loss_yards,
        def_fumbles_forced,
        def_sacks,
        def_sack_yards,
        def_qb_hits,
        def_interceptions,
        def_interception_yards,
        def_pass_defended,
        def_tds,
        def_fumbles,
        def_safeties,

        -- fumbles / misc / penalties
        misc_yards,
        fumble_recovery_own,
        fumble_recovery_yards_own,
        fumble_recovery_opp,
        fumble_recovery_yards_opp,
        fumble_recovery_tds,
        penalties,
        penalty_yards,
        fumbles_forced_by_opp,
        fumbles_not_forced,
        fumbles_out_of_bounds,
        fumbles_total,
        fumbles_lost_total,

        -- returns
        punt_returns,
        punt_return_yards,
        kickoff_returns,
        kickoff_return_yards,

        -- field goals
        fg_made,
        fg_att,
        fg_missed,
        fg_blocked,
        fg_long,
        fg_pct,
        fg_made_0_19,
        fg_made_20_29,
        fg_made_30_39,
        fg_made_40_49,
        fg_made_50_59,
        fg_made_60_,
        fg_missed_0_19,
        fg_missed_20_29,
        fg_missed_30_39,
        fg_missed_40_49,
        fg_missed_50_59,
        fg_missed_60_,
        fg_made_list,
        fg_missed_list,
        fg_blocked_list,
        fg_made_distance,
        fg_missed_distance,
        fg_blocked_distance,

        -- PAT / game-winning FG
        pat_made,
        pat_att,
        pat_missed,
        pat_blocked,
        pat_pct,
        gwfg_made,
        gwfg_att,
        gwfg_missed,
        gwfg_blocked,
        gwfg_distance,

        -- punting
        pt_att,
        pt_blocked,
        pt_long,
        pt_yards,
        pt_inside_20,
        pt_out_of_bounds,
        pt_downed,
        pt_touchback,
        pt_fair_caught,
        pt_returned,
        pt_return_yards,
        pt_return_tds,
        pt_net_yards,

        -- fantasy
        fantasy_points,
        fantasy_points_ppr
    from source
    where player_id is not null
      and team is not null
)

select * from cleaned
