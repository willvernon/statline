-- Grain: 1 row per player x team x season x week
-- (week is null for pre-2002 seasonal rows).
-- Silver: full source columns + renames + key filters.

with source as (
    select * from {{ source('raw', 'nfl_rosters') }}
),

cleaned as (
    select
        season,
        team as team_abbr,
        position,
        depth_chart_position,
        jersey_number,
        status,
        full_name,
        first_name,
        last_name,
        birth_date,
        height,
        weight,
        college,
        gsis_id,
        espn_id,
        sportradar_id,
        yahoo_id,
        rotowire_id,
        pff_id,
        pfr_id,
        fantasy_data_id,
        sleeper_id,
        years_exp,
        headshot_url,
        ngs_position,
        week,
        game_type,
        status_description_abbr,
        football_name,
        esb_id,
        gsis_it_id,
        smart_id,
        entry_year,
        rookie_year,
        draft_club,
        draft_number
    from source
    where season is not null
      and team is not null
      and gsis_id is not null
)

select * from cleaned
