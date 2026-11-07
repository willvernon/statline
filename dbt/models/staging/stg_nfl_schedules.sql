-- Grain: 1 row per game.
-- Silver: full source columns + key filter.

with source as (
    select * from {{ source('raw', 'nfl_schedules') }}
),

cleaned as (
    select
        game_id,
        season,
        week,
        game_type,
        gameday,
        gametime,
        weekday,
        home_team,
        away_team,
        home_score,
        away_score,
        location,
        result,
        total,
        overtime,
        old_game_id,
        gsis,
        nfl_detail_id,
        pfr,
        pff,
        espn,
        ftn,
        away_rest,
        home_rest,
        away_moneyline,
        home_moneyline,
        spread_line,
        away_spread_odds,
        home_spread_odds,
        total_line,
        under_odds,
        over_odds,
        div_game,
        roof,
        surface,
        temp,
        wind,
        away_qb_id,
        home_qb_id,
        away_qb_name,
        home_qb_name,
        away_coach,
        home_coach,
        referee,
        stadium_id,
        stadium
    from source
    where game_id is not null
)

select * from cleaned
